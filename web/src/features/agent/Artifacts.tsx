import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Artifact = {
  id: string
  kind: 'email_draft' | 'document'
  content: { to?: string; subject?: string; body?: string; title?: string; content?: string }
  created_at: string
}

/** Drafts the agent produced for this task. Read straight from the table — RLS
 *  keeps it to the signed-in user's rows. */
export function Artifacts({ taskId, version }: { taskId: string; version: number }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('agent_artifacts')
      .select('id, kind, content, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setArtifacts((data ?? []) as Artifact[])
      })
    return () => {
      cancelled = true
    }
  }, [taskId, version])

  if (artifacts.length === 0) return null

  return (
    <div className="agent-section artifacts">
      <h4>Drafts</h4>
      {artifacts.map((artifact) =>
        artifact.kind === 'email_draft' ? (
          <details key={artifact.id} className="artifact">
            <summary>
              <span className="artifact-kind">Email draft</span>
              {artifact.content.subject || '(no subject)'}
            </summary>
            <p className="artifact-meta">
              To: {artifact.content.to || '(not specified)'} · never sent — copy it into your
              mail client when you're happy with it
            </p>
            <pre>{artifact.content.body}</pre>
          </details>
        ) : (
          <details key={artifact.id} className="artifact">
            <summary>
              <span className="artifact-kind">Document</span>
              {artifact.content.title || 'Untitled'}
            </summary>
            <pre>{artifact.content.content}</pre>
          </details>
        ),
      )}
    </div>
  )
}
