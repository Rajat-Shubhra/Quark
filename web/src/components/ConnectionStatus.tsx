import { useEffect, useState } from 'react'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'

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

/** Dev-time panel confirming both paths to Supabase are live. */
export function ConnectionStatus() {
  const [browserState, setBrowserState] = useState<CheckState>('checking')
  const [browserDetail, setBrowserDetail] = useState<string>()
  const [serverState, setServerState] = useState<CheckState>('checking')
  const [serverDetail, setServerDetail] = useState<string>()

  useEffect(() => {
    if (!supabaseUrl) {
      setBrowserState('fail')
      setBrowserDetail('SUPABASE_URL missing from .env')
      return
    }
    fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseAnonKey } })
      .then((res) => {
        setBrowserState(res.ok ? 'ok' : 'fail')
        if (!res.ok) setBrowserDetail(`HTTP ${res.status}`)
      })
      .catch((err) => {
        setBrowserState('fail')
        setBrowserDetail(String(err))
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
    <ul className="checks">
      <StatusRow label="Supabase reachable from browser" state={browserState} detail={browserDetail} />
      <StatusRow label="Agent server reachable (/api/health)" state={serverState} detail={serverDetail} />
    </ul>
  )
}
