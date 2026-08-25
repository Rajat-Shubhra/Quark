import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { env } from './env'
import { agentRoutes } from './routes/agent'

const app = new Hono()

// Confirms the server can see its env and reach Supabase.
// The Vite dev server proxies /api/* here.
app.get('/api/health', async (c) => {
  let supabaseStatus = 'unreachable'
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.SUPABASE_ANON_KEY },
    })
    supabaseStatus = res.ok ? 'connected' : `http ${res.status}`
  } catch {
    // leave as 'unreachable'
  }
  return c.json({ ok: supabaseStatus === 'connected', supabase: supabaseStatus })
})

app.route('/api/agent', agentRoutes)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Quark agent server listening on http://localhost:${info.port}`)
})
