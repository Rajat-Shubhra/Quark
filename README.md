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
3. Apply the database schema: open the Supabase dashboard → SQL Editor and run each
   file in [supabase/migrations](supabase/migrations) in order —
   `0001_init.sql` (tasks + notes) then `0002_agent_runs.sql` (agent runs +
   artifacts). Both set up Row-Level Security. (The REST API can't run DDL, so this
   step is manual unless you use the Supabase CLI.)
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
- **A cold dev start takes ~20-25 seconds.** BlockNote and Mantine are a large
  dependency graph, and Vite holds every request until pre-bundling finishes.
  That silence is normal — wait 30s before assuming it's stuck.
- **After changing dependencies, check for a duplicate React.** npm workspaces
  can leave one copy at the repo root and another under `web/`, which makes
  BlockNote and Mantine bind to a different React than the app and kills the
  dev server with no error. `resolve.dedupe` guards against it; if it happens
  anyway, delete every `node_modules` plus `package-lock.json` and reinstall.

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

The task drawer is laid out as a page rather than a form — the title is the heading,
the description a subtitle, and the note fills the body. Type `/` in the note for the
block menu (headings, lists, quotes, toggles).

## The agent

Open a task and press **Ask the agent**. It classifies the task against the tools it
actually has and the UI renders one of three states from the returned JSON:

- **CAN_DO** — it finished the work using its tools.
- **PARTIAL** — it did its part (drafting, structuring, planning) and lists what only
  you can do.
- **HUMAN_ONLY** — it can't act, so it gives the shortest concrete guide.

**The confirmation gate is enforced in `server/src/agent/runner.ts`, not by the
model.** A run is gated if the model asks for confirmation *or* if any tool reports
that this particular call has real consequences — currently, overwriting a note you
have already written in. A run sitting in `awaiting_confirmation` has executed
nothing; its actions live in `pending_actions` and only ever run through
`POST /api/agent/runs/:id/confirm`. A model returning `confirmation_required: false`
cannot talk its way past a side effect.

Requests are authenticated with the user's Supabase access token and every database
operation runs through a client carrying that token, so RLS still applies — the
service-role key is never used to serve a request.

The tool set is deliberately just `write_note` for now; the agent is told that is all
it has, so it classifies honestly rather than promising things it cannot do. The
remaining four tools land in milestone 6.

## Milestones

- [x] 1. Scaffold + Supabase connection
- [x] 2. Auth (email sign-up / log-in)
- [x] 3. Data model + Kanban board (RLS)
- [x] 4. BlockNote notes attached to tasks
- [x] 5. Agent end-to-end with one action (`write_note`) + confirmation gate
- [ ] 6. Full tool set: `web_search`, `create_subtasks`, `draft_email`, `draft_document`

## Not in v1 (TODOs, deliberately unbuilt)

Real-time collaborative editing · sharing between users · mobile app · offline mode ·
any tools beyond the five above.
