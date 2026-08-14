import { useEffect, useState } from 'react'
import { supabase, supabaseUrl } from './lib/supabase'

type CheckState = 'checking' | 'ok' | 'fail'

function StatusRow({ label, state, detail }: { label: string; state: CheckState; detail?: string }) {
  const icon = state === 'checking' ? '…' : state === 'ok' ? '✓' : '✗'
  return (
    <li className={`status ${state}`}>
      <span className="icon">{icon}</span>
      <span>{label}</span>
      {detail && <span className="detail">{detail}</span>}
    </li>
  )
}

export default function App() {
  const [supabaseState, setSupabaseState] = useState<CheckState>('checking')
  const [supabaseDetail, setSupabaseDetail] = useState<string>()
  const [serverState, setServerState] = useState<CheckState>('checking')
  const [serverDetail, setServerDetail] = useState<string>()

  useEffect(() => {
    if (!supabaseUrl) {
      setSupabaseState('fail')
      setSupabaseDetail('SUPABASE_URL missing from .env')
      return
    }
    // Auth health endpoint works before any tables exist.
    supabase.auth
      .getSession()
      .then(() => fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: __SUPABASE_ANON_KEY__ } }))
      .then((res) => {
        setSupabaseState(res.ok ? 'ok' : 'fail')
        if (!res.ok) setSupabaseDetail(`HTTP ${res.status}`)
      })
      .catch((err) => {
        setSupabaseState('fail')
        setSupabaseDetail(String(err))
      })
  }, [])

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { ok: boolean; supabase: string }) => {
        setServerState(body.ok ? 'ok' : 'fail')
        setServerDetail(`supabase from server: ${body.supabase}`)
      })
      .catch((err) => {
        setServerState('fail')
        setServerDetail(String(err))
      })
  }, [])

  return (
    <main>
      <h1>Quark</h1>
      <p className="tagline">Notes + Kanban + a capability-aware task agent.</p>
      <h2>Milestone 1 — walking skeleton</h2>
      <ul>
        <StatusRow label="Supabase reachable from browser" state={supabaseState} detail={supabaseDetail} />
        <StatusRow label="Agent server reachable (/api/health)" state={serverState} detail={serverDetail} />
      </ul>
      <p className="next">Next up: auth, board, notes, agent.</p>
    </main>
  )
}
