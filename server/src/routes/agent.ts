import { Hono } from 'hono'
import { authenticate, clientForUser } from '../supabase'
import { startRun, resolveRun } from '../agent/runner'
import type { TaskContext } from '../agent/prompt'

type NoteBlock = { content?: { text?: string }[] }

/** Flatten a BlockNote document to plain text for the prompt. */
function blocksToText(blocks: NoteBlock[]): string {
  return blocks
    .map((block) => (block.content ?? []).map((piece) => piece.text ?? '').join(''))
    .join('\n')
}

export const agentRoutes = new Hono()

agentRoutes.post('/run', async (c) => {
  const user = await authenticate(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Not signed in' }, 401)

  const body = await c.req.json<{ taskId?: string }>().catch(() => ({}) as { taskId?: string })
  if (!body.taskId) return c.json({ error: 'taskId is required' }, 400)

  const supabase = clientForUser(user.accessToken)

  // RLS means a task belonging to someone else simply isn't found.
  const { data: task, error } = await supabase
    .from('tasks')
    .select('id, title, description, status')
    .eq('id', body.taskId)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!task) return c.json({ error: 'Task not found' }, 404)

  const { data: note } = await supabase
    .from('notes')
    .select('content')
    .eq('task_id', task.id)
    .maybeSingle()

  const context: TaskContext = {
    id: task.id as string,
    title: task.title as string,
    description: (task.description as string) ?? '',
    status: task.status as string,
    noteText: blocksToText((note?.content ?? []) as NoteBlock[]),
  }

  try {
    const run = await startRun({ supabase, userId: user.id, task: context })
    return c.json({ run })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[agent] run failed:', message)
    return c.json({ error: message }, 500)
  }
})

agentRoutes.post('/runs/:id/confirm', async (c) => {
  const user = await authenticate(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Not signed in' }, 401)

  const body = await c.req.json<{ approve?: boolean }>().catch(() => ({}) as { approve?: boolean })
  if (typeof body.approve !== 'boolean') {
    return c.json({ error: 'approve must be true or false' }, 400)
  }

  try {
    const run = await resolveRun({
      supabase: clientForUser(user.accessToken),
      userId: user.id,
      runId: c.req.param('id'),
      approve: body.approve,
    })
    return c.json({ run })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 400)
  }
})

/** Latest run for a task, so reopening a task shows what the agent last said. */
agentRoutes.get('/tasks/:taskId/latest-run', async (c) => {
  const user = await authenticate(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Not signed in' }, 401)

  const { data } = await clientForUser(user.accessToken)
    .from('agent_runs')
    .select('*')
    .eq('task_id', c.req.param('taskId'))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return c.json({ run: data ?? null })
})
