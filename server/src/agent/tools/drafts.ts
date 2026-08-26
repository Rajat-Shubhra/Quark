import type { Tool, ToolContext } from './types'

function field(input: unknown, keys: string[]): string {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>
    for (const key of keys) {
      if (typeof record[key] === 'string') return (record[key] as string).trim()
    }
  }
  return ''
}

/**
 * Models sometimes send every field packed into one string
 * ("to: X, subject: Y, body: Z"). Read one field, stopping at the next field
 * marker — without the lookahead, `subject` swallows ", body: …" too.
 */
function fromLooseString(input: unknown, label: string): string {
  if (typeof input !== 'string') return ''
  const stop = '(?=,?\\s*(?:to|subject|title|body|content)\\s*[:=]|\\n|$)'
  const match = input.match(new RegExp(`${label}\\s*[:=]\\s*"?(.*?)"?${stop}`, 'is'))
  return match?.[1]?.trim().replace(/,$/, '') ?? ''
}

function parseInput(input: unknown): Record<string, string> {
  if (typeof input === 'string') {
    const text = input.trim()
    if (text.startsWith('{')) {
      try {
        return parseInput(JSON.parse(text))
      } catch {
        // fall through
      }
    }
    // The body runs to the end, so it takes everything after its marker.
    const bodyOf = (label: string) =>
      input.match(new RegExp(`${label}\\s*[:=]\\s*"?([\\s\\S]+?)"?\\s*$`, 'i'))?.[1]?.trim() ?? ''

    return {
      to: fromLooseString(input, 'to'),
      subject: fromLooseString(input, 'subject'),
      title: fromLooseString(input, 'title'),
      body: bodyOf('body') || text,
      content: bodyOf('content') || text,
    }
  }

  return {
    to: field(input, ['to', 'recipient']),
    subject: field(input, ['subject']),
    title: field(input, ['title']),
    body: field(input, ['body', 'message', 'text']),
    content: field(input, ['content', 'body', 'text']),
  }
}

async function saveArtifact(
  ctx: ToolContext,
  kind: 'email_draft' | 'document',
  content: Record<string, string>,
): Promise<void> {
  const { error } = await ctx.supabase.from('agent_artifacts').insert({
    user_id: ctx.userId,
    run_id: ctx.runId,
    task_id: ctx.taskId,
    kind,
    content,
  })
  if (error) throw new Error(`Could not save the ${kind.replace('_', ' ')}: ${error.message}`)
}

/**
 * Produces an email draft and files it against the task. It never sends —
 * there is no send path anywhere in the codebase — so it needs no approval;
 * nothing leaves the app. If sending is ever added, it belongs behind the gate.
 */
export const draftEmail: Tool = {
  name: 'draft_email',

  async requiresConfirmation() {
    return false
  },

  async describeConsequence(input) {
    const { to, subject } = parseInput(input)
    return `Save an email draft to ${to || 'the recipient'} about "${subject || 'this task'}". It will not be sent.`
  },

  async execute(input, ctx) {
    const { to, subject, body } = parseInput(input)
    if (!body) throw new Error('draft_email needs a body')

    await saveArtifact(ctx, 'email_draft', { to, subject, body })
    return `Drafted an email to ${to || '(recipient not specified)'} — saved as a draft, not sent.`
  },
}

export const draftDocument: Tool = {
  name: 'draft_document',

  async requiresConfirmation() {
    return false
  },

  async describeConsequence(input) {
    const { title } = parseInput(input)
    return `Save a document draft titled "${title || 'Untitled'}".`
  },

  async execute(input, ctx) {
    const { title, content } = parseInput(input)
    if (!content) throw new Error('draft_document needs content')

    await saveArtifact(ctx, 'document', { title: title || 'Untitled', content })
    return `Drafted "${title || 'Untitled'}" (${content.length} characters).`
  },
}
