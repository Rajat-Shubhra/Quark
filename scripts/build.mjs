// Root build: typecheck both workspaces, then bundle the web app.
//
// This deliberately does NOT shell out to `npm run build -w <workspace>`. On
// this machine nested npm invocations (npm spawning npm) hang indefinitely —
// the child starts, prints, and never exits — so everything here is spawned as
// a plain node process instead. Same reasoning as web/dev.mjs.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')

function typecheck(workspace) {
  console.log(`> typechecking ${workspace}`)
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', path.join(root, workspace, 'tsconfig.json'), '--noEmit'],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) {
    console.error(`typecheck failed in ${workspace}`)
    process.exit(result.status ?? 1)
  }
}

typecheck('web')
typecheck('server')

console.log('> building web')
await build({ root: path.join(root, 'web'), configLoader: 'native' })

console.log('build complete')
process.exit(0)
