export type Classification = 'CAN_DO' | 'PARTIAL' | 'HUMAN_ONLY'

export type AgentAction = {
  tool: string
  input: unknown
  result: string
}

export type ExecutedAction = AgentAction & { ok: boolean }

export type AgentResponse = {
  understanding: string
  classification: Classification
  reasoning: string
  plan: string[]
  actions_taken: AgentAction[]
  confirmation_required: boolean
  confirmation_prompt: string
  human_steps: string[]
  result_summary: string
}

export type RunStatus = 'running' | 'awaiting_confirmation' | 'done' | 'rejected' | 'failed'

export type AgentRun = {
  id: string
  task_id: string
  status: RunStatus
  model: string
  response: AgentResponse | null
  pending_actions: AgentAction[]
  executed_actions: ExecutedAction[]
  error: string
  created_at: string
  resolved_at: string | null
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  CAN_DO: 'Agent can do this',
  PARTIAL: 'Agent can do part of this',
  HUMAN_ONLY: 'You need to do this',
}

export const CLASSIFICATION_BLURB: Record<Classification, string> = {
  CAN_DO: 'It finished the work with the tools it has.',
  PARTIAL: 'It did the part it could. The rest needs you.',
  HUMAN_ONLY: 'It cannot do this itself, so here is the shortest path.',
}
