# Clearance

*Nothing goes live without clearance.* A multi-company web platform that checks brand content
against approved guidelines, facts and embargoes before publication, and routes risky decisions to
authorised reviewers.

> **Status: prototype.** All screens work end to end (admin, manager, creator, reviewer) on fictional
> **demo data** kept in server memory (it resets when the server restarts). Supabase is not connected yet, and content checks are a
> clearly labelled **rule-based mock**, not an AI model. Detailed engineering notes:
> **[CONTEXT.md](CONTEXT.md)**.

## What works today

| Area | State |
|---|---|
| Admin screens | Dashboard, submissions (+ detail, release), campaigns, knowledge base, embargoes, analytics (+ CSV export), users & roles, AI agent settings, settings, audit log, notifications |
| Workflow | Creator submits text -> automatic check -> confirm intent -> accept fixes one by one -> send for review -> reviewer approves / requests changes / rejects -> manager assigns and releases. Text only for now |
| Database (`supabase/`) | Schema, workflow rules, row-level security and seed written and tested on a local Postgres; **not yet applied to a Supabase project** |
| Backend (`backend/`) | FastAPI mock check endpoint, called server-side by the frontend; no authentication yet |
| AI pipeline | Not built: no model, retrieval, OCR or video processing yet |

Roles (per company): **admin**, **manager**, **creator** (in-house and agency creators have the same
access), **reviewer**.

## Repository

| Folder | What it is |
|---|---|
| `frontend/` | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS v4 |
| `backend/` | FastAPI on Python 3.11, mock check endpoints |
| `supabase/` | Postgres migrations, seed data and access-rule tests |

Product specs (`designPRD.md`, `DataBasePRD.md`) are kept locally by the team and are not published here.

## Run locally

```bash
# Frontend: http://localhost:3000 (start the backend too: submissions are checked by it)
cd frontend
npm install
npm run dev

# Backend: http://localhost:8000/docs
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Tests
cd backend && pytest                                                 # backend
pip install pgserver psycopg2-binary && python supabase/tests/run_local.py   # database rules
cd frontend && npx tsc --noEmit && npm run lint && npm run build     # frontend
```

**Demo sign-in** (password `clearance-demo`, all fictional): `admin@sonicx.test`,
`manager@sonicx.test`, `reviewer@sonicx.test`, `creator@sonicx.test`, `agency@sonicx.test` (member of
two companies), `admin@northwind.test`.

## Environment variables

One `.env` file at the repo root is shared by the frontend and backend. It is git-ignored; never
commit real keys, and never give a server-only key a `NEXT_PUBLIC_` prefix.

| Variable | Used by | Notes |
|---|---|---|
| `FRONTEND_ORIGIN` | backend | Origin allowed by CORS. Default `http://localhost:3000` |
| `API_URL` | frontend (server) | Backend URL for checks. Falls back to `NEXT_PUBLIC_API_URL`, then `http://localhost:8000` |
| `NEXT_PUBLIC_API_URL` | frontend | Backend URL (fallback for `API_URL`) |
| `ALLOW_DEMO_AUTH` | frontend | Set `true` to allow demo sign-in in a production build. The demo session is **not secure**; use only for controlled demos |
| `GEMINI_API_KEY` | backend | Server-side only. Not used yet |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | Not used yet |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | backend | Server-side only. Not used yet |

## Deploying

**Backend on Render** (Web Service)

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (`$PORT` is set by Render; type it as is) |
| Health check path | `/health` |
| Environment | `PYTHON_VERSION=3.11.9`, `FRONTEND_ORIGIN=https://<your-frontend-domain>` |

**Frontend** (e.g. Vercel): root directory `frontend`, default Next.js build. Set
`ALLOW_DEMO_AUTH=true` only if you want the demo sign-in to work on that deployment, and
`API_URL` to the Render URL (checks fail with a clear message if it is unreachable).

## Known limitations

- Demo data lives in server memory: it resets on restart and is not shared between server instances.
- Demo sign-in uses a cookie that can be forged; real authentication arrives with Supabase Auth.
- Checks are deterministic mock rules for the fictional Sonic X brand, not AI.
- No file uploads or storage yet.
