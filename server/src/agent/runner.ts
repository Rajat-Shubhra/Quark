import type { SupabaseClient } from '@supabase/supabase-js'
import { SYSTEM_PROMPT, buildUserMessage, type TaskContext } from './prompt'
import { parseAgentResponse, type AgentAction, type AgentResponse } from './schema'
import { geminiProvider, type AgentProvider } from './provider'
import { TOOLS, type ToolContext } from './tools/index'

export type ExecutedAction = {
  tool: string
  input: unknown
  result: string
  ok: boolean
}

export type AgentRun = {
  id: string
  task_id: string
  status: 'running' | 'awaiting_confirmation' | 'done' | 'rejected' | 'failed'
  model: string
  response: AgentResponse | null
  pending_actions: AgentAction[]
  executed_actions: ExecutedAction[]
  error: string
  created_at: string
  resolved_at: string | null
}

/**
 * Actions naming a tool we don't have are dropped. The model is told exactly
 * what exists, but a hallucinated tool must never reach execution — and
 * silently ignoring it would misreport what happened, so it's recorded as a
 * failed action instead.
 */
function partitionActions(actions: AgentAction[]) {
  const runnable: AgentAction[] = []
  const rejected: ExecutedAction[] = []

  for (const action of actions) {
    if (TOOLS[action.tool]) runnable.push(action)
    else
      rejected.push({
        tool: action.tool,
        input: action.input,
        result: `No such tool: ${action.tool}. Nothing was run.`,
        ok: false,
      })
  }

  return { runnable, rejected }
}

/**
 * THE GATE. Confirmation is decided here, in code — never by trusting the
 * model's own flag. We gate if the model asked for confirmation OR if any tool
 * reports that this particular call has real consequences (e.g. overwriting a
 * note the user already wrote). A model that returns confirmation_required:
 * false cannot talk its way past a side effect.
 */
async function needsConfirmation(
  response: AgentResponse,
  actions: AgentAction[],
  ctx: ToolContext,
): Promise<boolean> {
  if (response.confirmation_required) return true

  for (const action of actions) {
    if (await TOOLS[action.tool].requiresConfirmation(action.input, ctx)) return true
  }
  return false
}

async function executeActions(actions: AgentAction[], ctx: ToolContext): Promise<ExecutedAction[]> {
  const executed: ExecutedAction[] = []

  for (const action of actions) {
    const tool = TOOLS[action.tool]
    if (!tool) {
      executed.push({ tool: action.tool, input: action.input, result: 'No such tool.', ok: false })
      continue
    }
    try {
      const result = await tool.execute(action.input, ctx)
      executed.push({ tool: action.tool, input: action.input, result, ok: true })
    } catch (error) {
      executed.push({
        tool: action.tool,
        input: action.input,
        result: error instanceof Error ? error.message : String(error),
        ok: false,
      })
    }
  }

  return executed
}

type StartRunArgs = {
  supabase: SupabaseClient
  userId: string
  task: TaskContext
  provider?: AgentProvider
}

/**
 * One turn: ask the model, validate, decide the gate, and either run the
 * actions or park them. Anything that throws is recorded as a failed run so
 * the UI has something concrete to show.
 */
export async function startRun({
  supabase,
  userId,
  task,
  provider = geminiProvider(),
}: StartRunArgs): Promise<AgentRun> {
  const { data: created, error: insertError } = await supabase
    .from('agent_runs')
    .insert({ user_id: userId, task_id: task.id, status: 'running', model: provider.model })
    .select()
    .single()

  if (insertError) throw new Error(`Could not start a run: ${insertError.message}`)
  const runId = created.id as string

  const fail = async (message: string): Promise<AgentRun> => {
    const { data } = await supabase
      .from('agent_runs')
      .update({ status: 'failed', error: message, resolved_at: new Date().toISOString() })
      .eq('id', runId)
      .select()
      .single()
    return data as AgentRun
  }

  let response: AgentResponse
  try {
    const raw = await provider.complete(SYSTEM_PROMPT, buildUserMessage(task))
    response = parseAgentResponse(raw)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }

  const ctx: ToolContext = {
    supabase,
    userId,
    taskId: task.id,
    taskTitle: task.title,
  }

  const { runnable, rejected } = partitionActions(response.actions_taken)

  try {
    if (await needsConfirmation(response, runnable, ctx)) {
      // Park the actions. Nothing has run at this point, and nothing will
      // until /confirm is called.
      const { data } = await supabase
        .from('agent_runs')
        .update({
          status: 'awaiting_confirmation',
          response,
          pending_actions: runnable,
          executed_actions: rejected,
        })
        .eq('id', runId)
        .select()
        .single()
      return data as AgentRun
    }

    const executed = await executeActions(runnable, ctx)
    const { data } = await supabase
      .from('agent_runs')
      .update({
        status: 'done',
        response,
        pending_actions: [],
        executed_actions: [...rejected, ...executed],
        resolved_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .select()
      .single()
    return data as AgentRun
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

type ResolveArgs = {
  supabase: SupabaseClient
  userId: string
  runId: string
  approve: boolean
}

/**
 * The only path that executes gated actions. It re-reads the run from the
 * database rather than trusting anything the client sent, and refuses to run
 * a second time for a run that has already been resolved.
 */
export async function resolveRun({
  supabase,
  userId,
  runId,
  approve,
}: ResolveArgs): Promise<AgentRun> {
  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('*, tasks(title)')
    .eq('id', runId)
    .single()

  if (error || !run) throw new Error('Run not found')
  if (run.status !== 'awaiting_confirmation') {
    throw new Error(`This run is ${run.status}; it is not waiting for approval.`)
  }

  if (!approve) {
    const { data } = await supabase
      .from('agent_runs')
      .update({ status: 'rejected', pending_actions: [], resolved_at: new Date().toISOString() })
      .eq('id', runId)
      .select()
      .single()
    return data as AgentRun
  }

  const ctx: ToolContext = {
    supabase,
    userId,
    taskId: run.task_id as string,
    taskTitle: (run.tasks as { title?: string } | null)?.title ?? '',
  }

  const executed = await executeActions((run.pending_actions ?? []) as AgentAction[], ctx)

  const { data } = await supabase
    .from('agent_runs')
    .update({
      status: 'done',
      pending_actions: [],
      executed_actions: [...((run.executed_actions ?? []) as ExecutedAction[]), ...executed],
      resolved_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select()
    .single()

  return data as AgentRun
}
