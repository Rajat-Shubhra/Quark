import type { SupabaseClient } from '@supabase/supabase-js'

export type ToolContext = {
  /** Scoped to the signed-in user, so every write is still subject to RLS. */
  supabase: SupabaseClient
  userId: string
  taskId: string
  taskTitle: string
}

export type Tool = {
  name: string
  /**
   * Whether running this action needs the user's approval first. Decided by
   * the server, not the model — see runner.ts.
   */
  requiresConfirmation(input: unknown, ctx: ToolContext): Promise<boolean>
  execute(input: unknown, ctx: ToolContext): Promise<string>
}
