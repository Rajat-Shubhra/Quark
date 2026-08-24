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
    // Keep the dep-optimizer cache out of node_modules. On this machine writes
    // under web/node_modules/.vite intermittently fail with EPERM/ENOENT (AV or
    // indexer holding handles), which stalls the optimizer — and because Vite
    // holds requests until it finishes, the dev server accepts connections but
    // never responds.
    cacheDir: '.vite-cache',
    resolve: {
      // Workspaces make it easy to end up with two copies of React (one hoisted
      // to the repo root, one under web/). When that happens BlockNote and
      // Mantine bind to a different React than the app, hooks break, and the
      // dev server stops responding. Pin every import to one copy.
      dedupe: ['react', 'react-dom'],
    },
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },
    server: {
      // Pin to IPv4. Left to itself, Node may resolve "localhost" to ::1 and
      // bind IPv6 only, which makes http://127.0.0.1:5173 refuse connections
      // and the browser fail depending on its resolution order.
      host: '127.0.0.1',
      // Fail loudly instead of silently drifting to 5174 if the port is taken.
      strictPort: true,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
  }
})
