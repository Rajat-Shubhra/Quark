import type { Tool, ToolContext } from './types'

type Block = {
  type: string
  props?: Record<string, unknown>
  content: { type: 'text'; text: string; styles: Record<string, unknown> }[]
}

function textBlock(type: string, text: string, props?: Record<string, unknown>): Block {
  return { type, ...(props ? { props } : {}), content: [{ type: 'text', text, styles: {} }] }
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

function readContent(input: unknown): string {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>
    for (const key of ['content', 'text', 'note', 'body']) {
      if (typeof record[key] === 'string') return record[key] as string
    }
  }
  throw new Error('write_note needs its content as a string')
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
