import type { Tool, ToolContext } from './types'

type StyledText = { type: 'text'; text: string; styles: Record<string, unknown> }

type Block = {
  type: string
  props?: Record<string, unknown>
  content: StyledText[]
}

/**
 * Inline markdown → BlockNote styled runs. Without this, **bold** reaches the
 * note as literal asterisks.
 */
export function inlineContent(text: string): StyledText[] {
  const pieces: StyledText[] = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      pieces.push({ type: 'text', text: text.slice(cursor, index), styles: {} })
    }

    const token = match[0]
    if (token.startsWith('**') || token.startsWith('__')) {
      pieces.push({ type: 'text', text: token.slice(2, -2), styles: { bold: true } })
    } else if (token.startsWith('`')) {
      pieces.push({ type: 'text', text: token.slice(1, -1), styles: { code: true } })
    } else {
      pieces.push({ type: 'text', text: token.slice(1, -1), styles: { italic: true } })
    }
    cursor = index + token.length
  }

  if (cursor < text.length) {
    pieces.push({ type: 'text', text: text.slice(cursor), styles: {} })
  }

  return pieces.length > 0 ? pieces : [{ type: 'text', text, styles: {} }]
}

function textBlock(type: string, text: string, props?: Record<string, unknown>): Block {
  return { type, ...(props ? { props } : {}), content: inlineContent(text) }
}

/**
 * The agent writes plain markdown-ish text; the note column stores BlockNote's
 * block array. Convert the handful of constructs worth supporting rather than
 * pulling a markdown parser in for prose the model already keeps simple.
 */
export function textToBlocks(text: string): Block[] {
  const blocks = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Markdown horizontal rules have no equivalent block, and land as a
    // literal "---" paragraph if left in.
    .filter((line) => !/^([-*_])\1{2,}$/.test(line))
    .map((line) => {
      const heading = line.match(/^(#{1,3})\s+(.*)$/)
      if (heading) return textBlock('heading', heading[2], { level: heading[1].length })

      const bullet = line.match(/^[-*]\s+(.*)$/)
      if (bullet) return textBlock('bulletListItem', bullet[1])

      const numbered = line.match(/^\d+[.)]\s+(.*)$/)
      if (numbered) return textBlock('numberedListItem', numbered[1])

      return textBlock('paragraph', line)
    })

  // BlockNote treats an empty array as "no document"; give it something.
  return blocks.length > 0 ? blocks : [textBlock('paragraph', '')]
}

const CONTENT_KEYS = ['content', 'text', 'note', 'body']

function stripWrappingQuotes(text: string): string {
  const trimmed = text.trim()
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  return quoted ? trimmed.slice(1, -1) : trimmed
}

/**
 * Decode escape sequences the model wrote literally. Observed in practice: a
 * whole document arriving as one line with the two characters \n between
 * paragraphs, which collapses into a single unreadable block.
 */
function decodeEscapes(text: string): string {
  if (text.includes('\n') || !/\\[nrt]/.test(text)) return text
  return text
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
    .replaceAll('\\t', '\t')
    .replaceAll('\\"', '"')
    .replaceAll('\\\\', '\\')
}

/**
 * The tool takes note text, but models routinely pass both arguments packed
 * into one string ("task_id: abc, content: # Heading…"), which otherwise ends
 * up printed at the top of the user's note. Recover just the content.
 */
function readContent(input: unknown): string {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>
    for (const key of CONTENT_KEYS) {
      if (typeof record[key] === 'string') return decodeEscapes(record[key] as string)
    }
    throw new Error('write_note needs a content string')
  }

  if (typeof input !== 'string') throw new Error('write_note needs its content as a string')

  let text = input.trim()

  // Sometimes the whole argument object arrives JSON-encoded.
  if (text.startsWith('{')) {
    try {
      return readContent(JSON.parse(text))
    } catch {
      // Not JSON after all — carry on with the string handling below.
    }
  }

  // Drop a leading "task_id: <id>, content:" style prefix. Only when task_id
  // really precedes the marker, so a note legitimately containing the word
  // "content:" is left alone.
  const marker = text.match(/content\s*[:=]\s*/i)
  if (marker?.index !== undefined && /task_?id/i.test(text.slice(0, marker.index))) {
    text = text.slice(marker.index + marker[0].length)
  }

  return decodeEscapes(stripWrappingQuotes(text))
}

async function existingNoteText(ctx: ToolContext): Promise<string> {
  const { data } = await ctx.supabase
    .from('notes')
    .select('content')
    .eq('task_id', ctx.taskId)
    .maybeSingle()

  const blocks = (data?.content ?? []) as Block[]
  return blocks
    .flatMap((block) => block.content?.map((piece) => piece.text ?? '') ?? [])
    .join('')
    .trim()
}

export const writeNote: Tool = {
  name: 'write_note',

  /**
   * Writing into an empty note is additive and safe. Overwriting a note the
   * user has already written in destroys their work, so that goes behind the
   * gate — regardless of what the model claimed about confirmation.
   */
  async requiresConfirmation(_input, ctx) {
    return (await existingNoteText(ctx)).length > 0
  },

  async describeConsequence(input, ctx) {
    const existing = await existingNoteText(ctx)
    const incoming = readContent(input)
    const preview = incoming.split('\n').find((line) => line.trim().length > 0) ?? ''

    return (
      `Replace the note on "${ctx.taskTitle}" with the agent's version, starting ` +
      `"${preview.replace(/^#+\s*/, '').slice(0, 80)}". ` +
      `Your existing note (${existing.length} characters) will be overwritten and cannot be recovered.`
    )
  },

  async execute(input, ctx) {
    const content = readContent(input)
    const blocks = textToBlocks(content)

    const { error } = await ctx.supabase.from('notes').upsert(
      {
        user_id: ctx.userId,
        task_id: ctx.taskId,
        title: ctx.taskTitle,
        content: blocks,
      },
      { onConflict: 'task_id' },
    )

    if (error) throw new Error(`Could not write the note: ${error.message}`)
    return `Wrote ${blocks.length} block${blocks.length === 1 ? '' : 's'} into the task's note.`
  },
}
