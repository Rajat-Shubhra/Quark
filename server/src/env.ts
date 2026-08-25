import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The single .env lives at the repo root, shared with the Vite config.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
config({ path: path.join(repoRoot, '.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    // Name only — never log secret values.
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`)
  }
  return value
}

export const env = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  // gemini-2.5-flash is no longer offered to new API keys.
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  // Deliberately not the generic PORT — dev tooling injects that for the web app.
  PORT: Number(process.env.AGENT_PORT ?? 8787),
}
