import { lazy, Suspense, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useAuth } from './features/auth/useAuth'
import { AuthForm } from './features/auth/AuthForm'
import { Board } from './features/board/Board'
import { ConnectionStatus } from './components/ConnectionStatus'

// Both views pull in BlockNote, so keep it out of the initial bundle.
const NotesPage = lazy(() =>
  import('./features/notes/NotesPage').then((m) => ({ default: m.NotesPage })),
)

type View = 'board' | 'notes'

function Workspace({ session }: { session: Session }) {
  const [view, setView] = useState<View>('board')

  return (
    <main className="workspace">
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

      <nav className="views" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'board'}
          className={view === 'board' ? 'active' : ''}
          onClick={() => setView('board')}
        >
          Board
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'notes'}
          className={view === 'notes' ? 'active' : ''}
          onClick={() => setView('notes')}
        >
          Notes
        </button>
      </nav>

      {view === 'board' ? (
        <Board userId={session.user.id} />
      ) : (
        <Suspense fallback={<p className="muted">Loading notes…</p>}>
          <NotesPage userId={session.user.id} />
        </Suspense>
      )}

      <footer className="diagnostics">
        <ConnectionStatus />
      </footer>
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
