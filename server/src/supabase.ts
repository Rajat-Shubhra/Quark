import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * A client acting as the signed-in user: it forwards their access token, so
 * every read and write is still filtered by Row-Level Security. The
 * service-role key is deliberately not used for request handling — the agent
 * should never be able to touch another user's rows, even through a bug.
 */
export function clientForUser(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type AuthedUser = { id: string; accessToken: string }

/** Verifies the bearer token with Supabase and returns the user it belongs to. */
export async function authenticate(authorization: string | undefined): Promise<AuthedUser | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null

  const { data, error } = await clientForUser(token).auth.getUser()
  if (error || !data.user) return null

  return { id: data.user.id, accessToken: token }
}
