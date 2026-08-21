import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Mode = 'signin' | 'signup'

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  function switchMode(next: Mode) {
    setMode(next)
    setError(undefined)
    setNotice(undefined)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    setNotice(undefined)

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Send the confirmation link back to wherever the app is running rather
        // than the project's default Site URL (localhost:3000 on a new project).
        options: { emailRedirectTo: window.location.origin },
      })
      if (signUpError) {
        setError(signUpError.message)
      } else if (!data.session) {
        // Email confirmation is enabled: sign-up returns a user but no session
        // until the link is clicked. See README for how to turn this off in dev.
        setNotice(`Almost there — confirm your address via the link sent to ${email}, then sign in.`)
        setMode('signin')
      }
      // If a session came back, AuthProvider swaps in the app on its own.
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) setError(signInError.message)
    }

    setBusy(false)
  }

  return (
    <main className="auth">
      <h1>Quark</h1>
      <p className="tagline">Notes + Kanban + a capability-aware task agent.</p>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'active' : ''}
          onClick={() => switchMode('signin')}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => switchMode('signup')}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={6}
          required
        />

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {error && <p className="message error">{error}</p>}
      {notice && <p className="message notice">{notice}</p>}
    </main>
  )
}
