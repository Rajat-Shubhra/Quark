import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AgentRun } from './types'

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
  }
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${response.status})`
}

export function useAgentRun(taskId: string) {
  const [run, setRun] = useState<AgentRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // Show what the agent last said when a task is reopened.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRun(null)
    setError(undefined)

    void (async () => {
      try {
        const response = await fetch(`/api/agent/tasks/${taskId}/latest-run`, {
          headers: await authHeaders(),
        })
        if (cancelled) return
        if (!response.ok) throw new Error(await readError(response))
        const body = (await response.json()) as { run: AgentRun | null }
        if (!cancelled) setRun(body.run)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [taskId])

  const start = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ taskId }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const body = (await response.json()) as { run: AgentRun }
      setRun(body.run)
      return body.run
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setBusy(false)
    }
  }, [taskId])

  const resolve = useCallback(
    async (approve: boolean) => {
      if (!run) return null
      setBusy(true)
      setError(undefined)
      try {
        const response = await fetch(`/api/agent/runs/${run.id}/confirm`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ approve }),
        })
        if (!response.ok) throw new Error(await readError(response))
        const body = (await response.json()) as { run: AgentRun }
        setRun(body.run)
        return body.run
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setBusy(false)
      }
    },
    [run],
  )

  return { run, loading, busy, error, start, resolve }
}
