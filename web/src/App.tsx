import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useAuth } from './features/auth/useAuth'
import { AuthForm } from './features/auth/AuthForm'
import { ConnectionStatus } from './components/ConnectionStatus'

function Workspace({ session }: { session: Session }) {
  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Quark</h1>
          <p className="tagline">Notes + Kanban + a capability-aware task agent.</p>
        </div>
        <div className="account">
          <span className="email">{session.user.email}</span>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            Log out
          </button>
        </div>
      </header>

      <section>
        <h2>Milestone 2 — signed in</h2>
        <p className="muted">
          Your session persists across reloads and devices. Next: the tasks and notes tables with
          row-level security, then the Kanban board.
        </p>
        <ConnectionStatus />
      </section>
    </main>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  // Avoid flashing the login form while the persisted session is restored.
  if (loading) {
    return (
      <main>
        <p className="muted">Loading…</p>
      </main>
    )
  }

  return session ? <Workspace session={session} /> : <AuthForm />
}
