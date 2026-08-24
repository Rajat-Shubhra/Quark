// Root build: typecheck both workspaces, then bundle the web app.
//
// This deliberately does NOT shell out to `npm run build -w <workspace>`. On
// this machine nested npm invocations (npm spawning npm) hang indefinitely —
// the child starts, prints, and never exits — so everything here is spawned as
// a plain node process instead. Same reasoning as web/dev.mjs.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))

// Resolve both tools from the workspace that declares them — npm hoists to the
// root sometimes and nests under web/ other times, so neither location is safe
// to hardcode.
const requireFromWeb = createRequire(path.join(root, 'web', 'package.json'))
// TypeScript 7 doesn't expose ./bin/tsc through its exports map, so go via the
// package.json (which is exported) and walk to the bin script.
const tsc = path.join(path.dirname(requireFromWeb.resolve('typescript/package.json')), 'bin', 'tsc')
const { build } = await import(pathToFileURL(requireFromWeb.resolve('vite')).href)

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
