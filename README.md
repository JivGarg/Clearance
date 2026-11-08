# Clearance

*Nothing goes live without clearance.* A multi-company web platform that checks brand content
against approved guidelines, facts and embargoes before publication, and routes risky decisions to
authorised reviewers. AI checks are currently a clearly labelled mock.

- Specs (`designPRD.md`, `DataBasePRD.md`) are kept locally by the team and are not published in this repo.
- **Working notes, commands, decisions, status and next steps: [CONTEXT.md](CONTEXT.md)** (start here)

| Folder | What it is |
|---|---|
| `frontend/` | Next.js + React + Tailwind app |
| `backend/` | FastAPI with mock check endpoints |
| `supabase/` | Postgres schema, workflow rules, row-level security, seed data, tests |

Copy `.env.example` to `.env` and fill it in before connecting to Supabase.
