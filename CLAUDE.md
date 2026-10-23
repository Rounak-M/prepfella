# PrepFella — notes for Claude sessions

Hackathon project (Codefest, PS2 "AI-Powered Web Applications × Job Readiness"). Team: Jaron D, Rounak M, Manjunath M.

- **Start here:** `docs/IMPLEMENTATION_PLAN.md`. Work phase by phase; tick the checkboxes there as items land.
- **Current state (2026-10-23):** All features built and verified end to end in the real UI: account picker + sign-up/sign-in (name + password) with a `/welcome` onboarding page (target, LinkedIn link/PDF import, resume, manual entries), profile + AI resume review, setup wizard, adaptive interview (text + voice), report, dashboard (career graph, interview progress, timeline sorted by date, next-up; past interviews live on the Mock interview tab), LinkedIn review + import, Fella drawer (centred window, animated), Advice page (roadmaps + free resources from a checked catalog). No seeded/template data (removed 2026-10-23): accounts are names only, and every AI feature works from what the user entered (profile, resume, LinkedIn text, career, interviews); Fella/Advice infer the field when no target role is set. Voice mode tested by the team with a real mic in the browser (2026-10-23).
- **Next step:** pre-cache TTS for the scripted demo questions; open the demo LinkedIn profiles once before the demo; rehearse the demo; decide whether the deck gets slides for LinkedIn review, career graph and Advice.

## Fixed decisions
- Next.js (App Router, TS, Tailwind) + FastAPI (Python **3.12** venv at `.venv`) + SQLite via SQLAlchemy (`backend/prepfella.db`; no Docker). **No real auth**: the picker lists every account; the 3 team accounts are passwordless, signed-up ones (name + password) ask for the password (PBKDF2 hash, `app/users.py`); either way the frontend then sends `X-User-Id`, so the password only gates the login screen. New columns on existing tables need a line in `users.migrate` (create_all doesn't alter tables).
- All AI through `app.llm.chat_json` (Nemotron on NVIDIA NIM, OpenAI-compatible). Speech through `app.speech` (hosted Riva ASR + Magpie TTS over gRPC). One LLM call per interview turn (§4.2 of the plan).
- Pitch deck rule: NVIDIA Nemotron is named **only on the last slide**; elsewhere say "AI"/"LLM".
- Brand: name is **PrepFella** (capital F). Main logo `logos/01-chat/`, assistant (Fella) icon `logos/05-fella/`. Colours `#10102A` bg, `#AE02EE` purple, gradient `#BB03F1→#7F2FDE`; font Outfit.
- UI: **iOS-style liquid glass tiles, light Miami purple, same tiles in light/dark; page white / AMOLED black with soft glows** Light mode = black text on the glass, dark mode = white. Charts use `components/charts/flow.tsx` (theme palettes). — tokens/utilities in `frontend/src/app/globals.css` (plan §5). Reuse `neu`, `neu-inset`, `neu-btn`, `btn-primary`, `field`; colours only via CSS vars (tiles override them for their content).
- NVIDIA free tier ≈40 req/min per API: every LLM/speech call must go through `llm.chat_json` / `speech.*`, which use `ratelimit.py` + `cache.py`. Keep `enable_thinking=false` (Nemotron otherwise returns empty content).
- Next.js 16.4 has breaking changes vs. older knowledge: read `frontend/AGENTS.md` / `node_modules/next/dist/docs` first. `cacheComponents` is on: anything reading the URL/localStorage must sit under `<Suspense>` (the `(app)` layout already wraps AppShell). lucide-react v1 has no brand icons (`components/icons.tsx`).
- LinkedIn blocks our IP (HTTP 999) after a burst of profile fetches; fetched profiles are cached a day in `backend/tmp/cache`. Before a demo, open the demo profiles once; the PDF upload is the fallback.
- LinkedIn's logged-out page blurs job titles/companies (`*******`) and omits job dates, so a link import only gets education; the import returns `hidden_jobs` and the dialog asks for the PDF export, which has everything.
- Dev loop: `uvicorn` has no `--reload` here; restart it after backend edits. `backend/prepfella.db` now holds the team's real entered data: never delete it casually (back it up to `backend/tmp/backups/` first); deleting recreates the 3 accounts empty.
- Start both servers with `start.ps1` (`-Prod`; `-Reset` wipes all data); on Rounak's laptop `run prep` (`~\.local\bin\run.cmd`) calls it. `docs/PrepFella_Architecture.docx` (Word, built by a docx-js script; edit the doc directly) explains architecture and internals for demo prep: keep it in sync when behaviour changes.

## Conventions
- Windows machine; Bash and PowerShell both available. Run Python via `.venv\Scripts\python`.
- Never commit `.env`. Commit only when the user asks.
- The user prefers local files over published artifacts.
- `design-tools/deck.js` rebuilds `Prepfella.pptx`; edit it rather than hand-editing the .pptx.
