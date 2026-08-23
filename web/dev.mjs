// Dev-server launcher. We start Vite through its JS API instead of the `vite`
// CLI because npm's .bin shim / run-script layer fails silently for Vite on
// some Windows setups, and use the native config loader so Vite never writes
// a bundled temp config (which fails there too).
// Configuration lives in vite.config.mjs; `root` is pinned so any cwd works.
import { createServer } from 'vite'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = fileURLToPath(new URL('.', import.meta.url))
const cacheDir = path.join(webRoot, '.vite-cache')

async function start() {
  const server = await createServer({ root: webRoot, configLoader: 'native' })
  await server.listen()
  server.printUrls()
}

try {
  await start()
} catch (error) {
  // Re-optimizing after a lockfile change fails with EPERM/ENOENT here when
  // something still holds a handle on the old cache. Clearing it and retrying
  // once beats leaving the server dead with a stack trace.
  if (error?.code !== 'EPERM' && error?.code !== 'ENOENT') throw error
  console.warn(`[dev] ${error.code} on the Vite cache — clearing ${cacheDir} and retrying`)
  await rm(cacheDir, { recursive: true, force: true })
  await start()
}
