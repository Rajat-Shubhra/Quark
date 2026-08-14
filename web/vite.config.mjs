// Plain-ESM config (not .ts) so Vite can load it with `configLoader: 'native'`,
// skipping the esbuild temp-file bundling step that fails on some Windows setups.
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The single .env lives at the repo root, shared with the server.
// Only SUPABASE_URL and SUPABASE_ANON_KEY are injected into the client bundle
// (both are browser-safe; RLS protects the data). The service-role key and
// GEMINI_API_KEY are never referenced here, so they cannot leak into the build.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')
  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },
    server: {
      proxy: {
        '/api': 'http://localhost:8787',
      },
    },
  }
})
