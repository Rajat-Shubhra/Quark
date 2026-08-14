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
3. `npm run dev` — web on http://localhost:5173, agent server on http://localhost:8787
   (the Vite dev server proxies `/api/*` to it).

The root `.env` is shared by both workspaces. Only `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are injected into the browser bundle (see `web/vite.config.ts`);
the service-role and Gemini keys are never referenced client-side.

## Milestones

- [x] 1. Scaffold + Supabase connection
- [ ] 2. Auth (email sign-up / log-in)
- [ ] 3. Data model + Kanban board (RLS)
- [ ] 4. BlockNote notes attached to tasks
- [ ] 5. Agent end-to-end with one action (`write_note`) + confirmation gate
- [ ] 6. Full tool set: `web_search`, `create_subtasks`, `draft_email`, `draft_document`

## Not in v1 (TODOs, deliberately unbuilt)

Real-time collaborative editing · sharing between users · mobile app · offline mode ·
any tools beyond the five above.
