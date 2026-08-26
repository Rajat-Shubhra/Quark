import { useAgentRun } from './useAgentRun'
import {
  CLASSIFICATION_BLURB,
  CLASSIFICATION_LABEL,
  type AgentRun,
  type ExecutedAction,
} from './types'

function ActionList({ actions }: { actions: ExecutedAction[] }) {
  if (actions.length === 0) return null
  return (
    <ul className="agent-actions">
      {actions.map((action, index) => (
        <li key={index} className={action.ok ? 'ok' : 'failed'}>
          <code>{action.tool}</code> {action.result}
        </li>
      ))}
    </ul>
  )
}

function Steps({ title, steps, ordered }: { title: string; steps: string[]; ordered?: boolean }) {
  if (steps.length === 0) return null
  const List = ordered ? 'ol' : 'ul'
  return (
    <div className="agent-section">
      <h4>{title}</h4>
      <List>
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </List>
    </div>
  )
}

/**
 * Everything here is driven by fields of the validated JSON — classification
 * picks the layout, and the gate is shown whenever the server says the run is
 * awaiting_confirmation. No prose is parsed.
 */
function RunView({
  run,
  busy,
  onResolve,
}: {
  run: AgentRun
  busy: boolean
  onResolve: (approve: boolean) => void
}) {
  if (run.status === 'failed') {
    return (
      <div className="message error">
        <strong>The agent could not finish.</strong> {run.error}
      </div>
    )
  }

  const response = run.response
  if (!response) return <p className="muted">No result recorded for this run.</p>

  const { classification } = response

  return (
    <div className={`agent-result ${classification.toLowerCase()}`}>
      <div className="agent-verdict">
        <span className={`badge ${classification.toLowerCase()}`}>
          {CLASSIFICATION_LABEL[classification]}
        </span>
        <span className="muted">{CLASSIFICATION_BLURB[classification]}</span>
      </div>

      {response.result_summary && <p className="agent-summary">{response.result_summary}</p>}

      {/* The gate. Nothing in pending_actions has run yet. */}
      {run.status === 'awaiting_confirmation' && (
        <div className="agent-gate">
          <h4>Needs your approval</h4>
          <p>{response.confirmation_prompt || 'The agent wants to make a change to this task.'}</p>
          {run.pending_actions.length > 0 && (
            <ul className="agent-actions pending">
              {run.pending_actions.map((action, index) => (
                <li key={index}>
                  <code>{action.tool}</code> is waiting to run
                </li>
              ))}
            </ul>
          )}
          <div className="agent-gate-buttons">
            <button type="button" className="primary" disabled={busy} onClick={() => onResolve(true)}>
              {busy ? 'Working…' : 'Approve and run'}
            </button>
            <button type="button" disabled={busy} onClick={() => onResolve(false)}>
              Reject
            </button>
          </div>
        </div>
      )}

      {run.status === 'rejected' && (
        <p className="muted">You rejected this. Nothing was changed.</p>
      )}

      {run.executed_actions.length > 0 && (
        <div className="agent-section">
          <h4>What it did</h4>
          <ActionList actions={run.executed_actions} />
        </div>
      )}

      <Steps
        title={classification === 'HUMAN_ONLY' ? 'Your steps' : 'What you still need to do'}
        steps={response.human_steps}
        ordered
      />

      <Steps title="Its plan" steps={response.plan} ordered />

      <details className="agent-reasoning">
        <summary>Why it judged this way</summary>
        <p>{response.understanding}</p>
        <p>{response.reasoning}</p>
        <p className="muted">
          {run.model} · {new Date(run.created_at).toLocaleString()}
        </p>
      </details>
    </div>
  )
}

export function AgentPanel({
  taskId,
  onActionsExecuted,
}: {
  taskId: string
  /** Which tools actually ran, so the surrounding UI can refresh what changed. */
  onActionsExecuted: (tools: string[]) => void
}) {
  const { run, loading, busy, error, start, resolve } = useAgentRun(taskId)

  const report = (candidate: AgentRun | null) => {
    const tools = (candidate?.executed_actions ?? [])
      .filter((action) => action.ok)
      .map((action) => action.tool)
    if (tools.length > 0) onActionsExecuted(tools)
  }

  async function handleStart() {
    report(await start())
  }

  async function handleResolve(approve: boolean) {
    report(await resolve(approve))
  }

  return (
    <section className="agent">
      <div className="agent-header">
        <h3>Agent</h3>
        <button type="button" onClick={handleStart} disabled={busy || loading}>
          {busy ? 'Thinking…' : run ? 'Ask again' : 'Ask the agent'}
        </button>
      </div>

      {error && <p className="message error">{error}</p>}
      {loading ? (
        <p className="muted">Checking for earlier runs…</p>
      ) : run ? (
        <RunView run={run} busy={busy} onResolve={handleResolve} />
      ) : (
        <p className="muted">
          Ask the agent to judge this task: it will say whether it can do it, do the part it can,
          or give you the shortest path to doing it yourself.
        </p>
      )}
    </section>
  )
}
