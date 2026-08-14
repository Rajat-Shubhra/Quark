// Dev-server launcher. We start Vite through its JS API instead of the `vite`
// CLI because npm's .bin shim / run-script layer fails silently for Vite on
// some Windows setups, and use the native config loader so Vite never writes
// a bundled temp config into node_modules/.vite-temp (which also fails there).
// Configuration lives in vite.config.mjs; `root` is pinned so any cwd works.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('.', import.meta.url))

const server = await createServer({ root: webRoot, configLoader: 'native' })
await server.listen()
server.printUrls()
