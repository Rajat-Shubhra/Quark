import type { Tool, ToolContext } from './types'

const POSITION_GAP = 1024

/** Accepts an array, a newline list, or {items: [...]} — models vary. */
function readItems(input: unknown): string[] {
  const fromUnknown = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === 'string'
            ? item
            : typeof (item as { title?: string })?.title === 'string'
              ? ((item as { title: string }).title)
              : '',
        )
        .filter(Boolean)
    }
    if (typeof value === 'string') {
      const text = value.trim()
      if (text.startsWith('[') || text.startsWith('{')) {
        try {
          return fromUnknown(JSON.parse(text))
        } catch {
          // fall through to line splitting
        }
      }
      return text
        .split('\n')
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean)
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const key of ['items', 'subtasks', 'tasks', 'list']) {
        if (record[key] !== undefined) return fromUnknown(record[key])
      }
    }
    return []
  }

  const items = fromUnknown(input)
  if (items.length === 0) throw new Error('create_subtasks needs a list of subtask titles')
  // Guard against a model that decides to emit fifty of them.
  return items.slice(0, 20)
}

async function nextPosition(ctx: ToolContext): Promise<number> {
  const { data } = await ctx.supabase
    .from('tasks')
    .select('position')
    .eq('parent_id', ctx.taskId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return ((data?.position as number) ?? 0) + POSITION_GAP
}

export const createSubtasks: Tool = {
  name: 'create_subtasks',

  // Adding subtasks is additive and easy to undo, so it doesn't need approval.
  // (The gate is for destructive or outward-facing actions.)
  async requiresConfirmation() {
    return false
  },

  async describeConsequence(input, ctx) {
    return `Add ${readItems(input).length} subtasks under "${ctx.taskTitle}".`
  },

  async execute(input, ctx) {
    const items = readItems(input)
    const start = await nextPosition(ctx)

    const rows = items.map((title, index) => ({
      user_id: ctx.userId,
      parent_id: ctx.taskId,
      title: title.slice(0, 200),
      status: 'todo',
      position: start + index * POSITION_GAP,
    }))

    const { error } = await ctx.supabase.from('tasks').insert(rows)
    if (error) throw new Error(`Could not create subtasks: ${error.message}`)

    return `Created ${rows.length} subtask${rows.length === 1 ? '' : 's'}.`
  },
}
