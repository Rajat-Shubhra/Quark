# Quark

A Notion-style workspace where notes and a Kanban board live together, synced through
Supabase — plus the differentiating feature: a **capability-aware task agent** that
judges each task as `CAN_DO` (agent completes it), `PARTIAL` (agent does part, human
finishes), or `HUMAN_ONLY` (agent produces the easiest step-by-step guide).

The agent contract lives in [task-agent-prompt.md](task-agent-prompt.md): it returns
structured JSON only, the UI renders states from that JSON (never prose), and
confirmation for side-effecting actions is enforced **in server code**, not by the model.

## Stack

- **Web** (`web/`): React (Vite) + TypeScript, BlockNote editor, @dnd-kit Kanban
- **Server** (`server/`): Hono on Node — the only place AI keys and the Supabase
  service-role key are used
- **Supabase**: Postgres + Auth + Row-Level Security (`supabase/migrations/`)
- **AI**: Google Gemini to start (free tier), swapping to the Anthropic API later —
  the provider sits behind one interface in `server/src/agent/`

## Setup

1. `npm install` (installs both workspaces)
2. Copy `.env.example` to `.env` at the repo root and fill in the keys:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase
     dashboard → Project Settings → API. The service-role key is **server-only**.
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey. **Server-only.**
3. Apply the database schema: open the Supabase dashboard → SQL Editor, paste the
   contents of [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql),
   and run it. This creates `tasks` and `notes` with Row-Level Security. (The REST
   API can't run DDL, so this step is manual unless you use the Supabase CLI.)
4. `npm run dev` — web on http://127.0.0.1:5173, agent server on http://127.0.0.1:8787
   (the Vite dev server proxies `/api/*` to it).

To build: **`node scripts/build.mjs`** (typechecks both workspaces, then bundles the
web app). See the Windows notes below before reaching for `npm run build`.

## Windows notes

This repo works around three problems seen on the development machine. Don't
"simplify" these back to the conventional commands without re-testing:

- **`npm run` hangs for build-like scripts.** `npm run build` stalls partway
  through and never writes `dist/`, even though the exact same command run as
  `node scripts/build.mjs` finishes in a few seconds. Nested `npm run … -w
  <workspace>` (npm spawning npm) hangs the same way, which is why the root
  build script shells out to node directly instead of delegating to workspaces.
- **The `vite` CLI dies silently** when launched through npm's `.bin` shim, so
  Vite is started via its JS API in `web/dev.mjs` and `web/build.mjs`, with a
  plain `vite.config.mjs` and `configLoader: 'native'` to skip config bundling.
- **Only run one dev server at a time.** Two Vite instances sharing one cache
  dir delete each other's `deps_temp_*` directories, which deadlocks the
  dependency optimizer — the server then accepts connections but never
  responds. `strictPort: true` makes a second instance fail loudly instead. If
  the dev server ever hangs without responding, kill stray node processes and
  delete `web/.vite-cache`.

The root `.env` is shared by both workspaces. Only `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are injected into the browser bundle (see `web/vite.config.ts`);
the service-role and Gemini keys are never referenced client-side.

## Auth

Email + password via Supabase Auth. The session is persisted by `supabase-js` and
restored on load, so a reload — or a visit from another device — stays signed in.

By default Supabase requires users to **confirm their email** before they can log in,
so sign-up shows a "check your inbox" notice rather than signing you straight in.
To turn that off while developing solo: Supabase dashboard → Authentication →
Providers → Email → disable "Confirm email".

## Notes

Each task has one BlockNote document, stored as the block array in `notes.content`
(jsonb). Edits autosave ~700ms after you stop typing, and anything still pending is
flushed when the drawer closes. The row is created lazily on first edit, so opening a
task you never write in doesn't leave an empty note behind.

`@mantine/core` and `@mantine/hooks` are pinned to v8 deliberately: BlockNote's Mantine
wrapper otherwise pulls Mantine v9, which requires React 19.

## Milestones

- [x] 1. Scaffold + Supabase connection
- [x] 2. Auth (email sign-up / log-in)
- [x] 3. Data model + Kanban board (RLS)
- [x] 4. BlockNote notes attached to tasks
- [ ] 5. Agent end-to-end with one action (`write_note`) + confirmation gate
- [ ] 6. Full tool set: `web_search`, `create_subtasks`, `draft_email`, `draft_document`

## Not in v1 (TODOs, deliberately unbuilt)

Real-time collaborative editing · sharing between users · mobile app · offline mode ·
any tools beyond the five above.
