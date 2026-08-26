import type { SupabaseClient } from '@supabase/supabase-js'

export type ToolContext = {
  /** Scoped to the signed-in user, so every write is still subject to RLS. */
  supabase: SupabaseClient
  userId: string
  taskId: string
  taskTitle: string
  /** The run these actions belong to — artifacts are filed against it. */
  runId: string
}

export type Tool = {
  name: string
  /**
   * Whether running this action needs the user's approval first. Decided by
   * the server, not the model — see runner.ts.
   */
  requiresConfirmation(input: unknown, ctx: ToolContext): Promise<boolean>
  /**
   * Plain-language description of what running this would do, used when the
   * server gates a run the model didn't expect to be gated (and so left
   * confirmation_prompt empty). The user must never be asked to approve
   * something unexplained.
   */
  describeConsequence(input: unknown, ctx: ToolContext): Promise<string>
  execute(input: unknown, ctx: ToolContext): Promise<string>
}
