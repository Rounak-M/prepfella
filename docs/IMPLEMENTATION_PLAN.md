# PrepFella — Implementation Plan

AI mock-interview web app for Codefest (Problem Statement 2: AI-Powered Web Applications × Job Readiness).
Team: Jaron D (01FE24BCA294), Rounak M (01FE24BCA298), Manjunath M (01FE24BCA079).

The pitch deck (`Prepfella.pptx`) is the contract: everything it shows the judges must exist in the demo.
This plan turns each slide's promise into something buildable, in the order that keeps a working demo at every step.

---

## 1. What we are building

A candidate picks a **role, experience level, interview type and difficulty**, then does a **live voice (or text) mock interview**.
The AI asks questions shaped by their resume, **adapts** after every answer, **scores each answer on four dimensions with quoted evidence**,
and finishes with a **report** and a **study plan**. An AI coach, **Fella**, answers questions about their results between interviews.
Beyond the deck: an **AI LinkedIn profile review** (paste a link → scores + rewrites) and a **career graph** on the dashboard
(seniority and salary over time, importable from LinkedIn).

### Demo story (≈3 minutes, what the judges see)
1. Pick the demo account (Jaron) on the account picker → dashboard shows two past sessions with a rising score trend.
2. Open **AI Profile Review** → role fit, strengths, gaps, resume red flags, interview plan (from an uploaded resume).
3. Start a **voice** interview: Backend Engineer · Fresher · Technical · Medium.
4. Answer 3–4 questions out loud. One weak answer triggers a **follow-up**; one answer mentions a resume claim and gets **verified**.
5. Finish → **report**: four-dimension scores, quoted evidence, top three fixes, a stronger model answer, auto-planned next session.
6. Click the **Fella** button → "Why did my indexing answer score low?" → grounded answer + a quiz question.

### Deck promise → build item
| Deck slide | Must exist in demo | Plan section |
|---|---|---|
| 3 The idea / 4 Journey | Setup wizard with the 4 picks; full loop | §6 Phase 1 |
| 5 Six features | Resume-aware Qs, adaptive, voice, evaluation, analytics, learning plan | §4, §6 |
| 6 AI Profile Review | Resume → structured review card | §4.1 |
| 7 Assistant (Fella) | Chat drawer grounded in the user's own data | §4.5 |
| 8 Adaptive engine | Score → rule → next move (harder / follow-up / easier / verify claim) | §4.3 |
| 9 Evaluation | 4 dimensions, each with evidence | §4.2 |
| 10 Report | Bar chart, top 3 fixes, next-session plan | §4.4 |
| 11–12 Architecture / stack | Next.js · FastAPI · Nemotron (NIM) · Riva ASR · Magpie TTS · SQLite | §2 |
| 15 Close | "Powered by NVIDIA Nemotron" | — |
| (not in deck yet) | LinkedIn profile review; career graph with LinkedIn import | §4.7, §4.8 |

---

## 2. Architecture and stack (decided)

```
Browser (Next.js)                 FastAPI backend                         NVIDIA hosted (build.nvidia.com, one API key)
─────────────────                 ───────────────                         ──────────────────────────────────────────────
Interview room ── WAV 16k ──────► /sessions/{id}/answer ── PCM ─────────► Riva ASR (gRPC)          → transcript
  mic (MediaRecorder→WAV)         │  metrics (wpm, fillers)
                                  │  one LLM call per turn ─────────────► Nemotron FAST (OpenAI API) → scores + next candidates
                                  │  adaptive rules pick next question
  <audio> ◄──── WAV ──────────────┤  TTS ─────────────────────────────────► Magpie TTS (gRPC)        → interviewer voice
  speechSynthesis fallback        │
Profile / Report / Fella ───────► /profile/review, /report, /assistant ─► Nemotron DEEP              → review, report, coaching
                                  └── SQLite file (SQLAlchemy; Postgres-ready)
```

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) + Tailwind CSS | UI direction: **modern, sleek — final design TBD** (§5) |
| Backend | FastAPI, Python **3.12** (`.venv` already created) | 3.12, not 3.14: wheel compatibility for grpc/riva |
| LLM | NVIDIA Nemotron via `https://integrate.api.nvidia.com/v1` (OpenAI SDK) | Two slots: `NIM_MODEL_FAST`, `NIM_MODEL_DEEP` |
| STT | Riva ASR on NVIDIA's hosted gRPC (`grpc.nvcf.nvidia.com:443`) | Parakeet CTC 0.6B; browser sends 16 kHz mono WAV |
| TTS | Magpie TTS Multilingual, same gRPC host | Voice `Magpie-Multilingual.EN-US.Aria`; fallback = browser `speechSynthesis` |
| DB | SQLite via SQLAlchemy (`backend/prepfella.db`, created on startup) | No Docker/server. Same models run on Postgres by changing `DATABASE_URL`. MVP retrieval = plain SQL (§4.5) |
| Auth | **None.** Three seeded demo accounts; the login page is an account picker | Frontend stores the chosen id and sends `X-User-Id`; backend `users.current_user` dependency |
| Charts | Recharts (frontend) | Report bars, dashboard trend, career graph |
| Rate limits | `app/ratelimit.py` + `app/cache.py` | Per-API budget (36/min default), wait-then-retry, disk cache. See §7 |

**Simplified on purpose (hackathon demo):** no Postgres/Docker, no Redis, no real auth. Delete `backend/prepfella.db` to reset all data.
If a judge asks: "SQLAlchemy models, Postgres-ready — swapping is one connection string; real sign-in is a post-hackathon item."

---

## 3. Repository layout

```
codefest/
├─ .env.example            ← copy to .env, fill NVIDIA key + model IDs
├─ backend/
│  ├─ requirements.txt
│  ├─ app/
│  │  ├─ main.py           ← FastAPI app, CORS, /health            (exists)
│  │  ├─ config.py         ← settings from .env                    (exists)
│  │  ├─ llm.py            ← chat_json() for every AI call         (exists)
│  │  ├─ speech.py         ← synthesize(), transcribe()            (exists)
│  │  ├─ db.py             ← SQLAlchemy engine/session (SQLite)    (exists)
│  │  ├─ models.py         ← tables (§3.1)                         (exists)
│  │  ├─ users.py          ← demo accounts, GET /users, /me        (exists)
│  │  ├─ prompts/          ← one .py per AI job (§4)               (todo)
│  │  ├─ engine/adaptive.py← decision rules (§4.3)                 (todo)
│  │  ├─ engine/metrics.py ← wpm, filler words, length             (todo)
│  │  ├─ routers/          ← profile, sessions, assistant, progress (todo)
│  │  └─ fallback_bank.json← static questions per role, used if the LLM fails (todo)
│  └─ scripts/
│     ├─ smoke_test.py     ← checks key, models, TTS, ASR          (exists)
│     └─ seed_demo.py      ← Jaron's resume, review, 2 past sessions (todo)
├─ frontend/               ← create in Phase 0 (command in §6)
├─ design-tools/           ← regenerates logos + pitch deck (npm run logos / deck)
├─ logos/                  ← brand assets (01-chat = main logo, 05-fella = assistant icon)
└─ docs/IMPLEMENTATION_PLAN.md
```

### 3.1 Data model
| Table | Key columns |
|---|---|
| `users` | id, email, name, tagline, created_at (no passwords) |
| `profiles` | user_id (PK), target_role, experience_level, resume_text, links (json), review (json), reviewed_at |
| `sessions` | id, user_id, role, level, interview_type (`technical`/`hr`/`mixed`), difficulty (`easy`/`medium`/`hard`), mode (`voice`/`text`), status, current_difficulty (1–5), started_at, ended_at, report (json) |
| `turns` | id, session_id, idx, kind (`main`/`follow_up`/`resume_probe`/`easier`), topic, question, answer_text, answer_seconds, wpm, filler_count, scores (json), evidence (json), feedback, decision (json), created_at |
| `assistant_messages` | id, user_id, role (`user`/`assistant`), content, created_at |
| `career_entries` | id, user_id, kind (`job`/`internship`/`education`), title, organization, start, end (null = present), level (0–6), salary, salary_period (`month`/`year`), currency, source (`manual`/`linkedin`) |
| `profiles` (added) | linkedin_text, linkedin_review (json), linkedin_reviewed_at; URL in `links.linkedin` |

### 3.2 API
| Method & path | Does |
|---|---|
| `GET /users`, `GET /me` | demo-account picker / current account. Every other route reads the `X-User-Id` header |
| `POST /profile/resume` (multipart PDF) | PyMuPDF text extraction → `profiles.resume_text` |
| `PUT /profile` | target role, level, links |
| `POST /profile/review` | AI Profile Review (§4.1) → stored JSON |
| `POST /sessions` | create from the 4 picks + mode → first question (+ audio URL) |
| `GET /sessions`, `GET /sessions/{id}` | list / detail with turns |
| `POST /sessions/{id}/answer` | multipart: `audio` (WAV) **or** `text` → transcript, per-turn scores, next question, `done` flag |
| `GET /sessions/{id}/turns/{idx}/audio` | WAV of the interviewer's question (cached on disk) |
| `POST /sessions/{id}/finish` | report (§4.4) |
| `POST /assistant/chat` | Fella reply (§4.5) |
| `GET /progress` | per-dimension averages per session, for the trend chart |
| `POST /profile/linkedin` (form: `url` and/or `pdf`), `GET /profile/linkedin` | LinkedIn review (§4.7). 422 `linkedin_unavailable` → ask for the PDF |
| `POST /profile/linkedin/import` (form: `url` / `pdf` / nothing = reuse last) | add positions + education to the career graph, skipping duplicates |
| `GET/POST /career`, `PUT/DELETE /career/{id}` | career graph entries (§4.8) |
| `GET /assistant/messages`, `DELETE /assistant/messages` | Fella history / clear |
| `GET/DELETE /advice/messages`, `POST /advice/chat {message}` | Advice chat (§4.9) → `{user, assistant: {content, resources[]}}` |

---

## 4. The AI jobs (prompts + JSON contracts)

All calls go through `llm.chat_json(system, user, deep=...)`, which strips `<think>` blocks and code fences and parses the first JSON object.
Every prompt ends with: *"Reply with one JSON object only, matching this shape: …"*. Validate fields in code; on a parse failure retry once with
"Your last reply was not valid JSON", then fall back (static question bank / neutral score) so the demo never dead-ends.
If the chosen Nemotron model reasons verbosely, add its no-reasoning switch to the system prompt (check the model card) and keep `max_tokens` tight.

### 4.1 AI Profile Review — `deep`, once per resume
Input: resume text, target role, level, links. Output:
```json
{
  "role_fit": {"level": "strong|good|developing", "summary": "..."},
  "strengths": ["SQL", "..."],
  "gaps": ["Statistics depth", "..."],
  "red_flags": [{"issue": "Dashboard project has no outcome", "fix": "Quantify who used it and what changed"}],
  "resume_claims": ["Built a Kafka pipeline for ..."],
  "interview_plan": [{"topic": "SQL", "kind": "technical", "count": 3}, {"topic": "STAR", "kind": "hr", "count": 2}]
}
```
`resume_claims` feed the "verify a claim" move; `interview_plan` seeds session topics.

### 4.2 Turn evaluation + next candidates — `fast`, **one call per answer**
Input: role, level, type, current difficulty (1–5), the question, the transcript, code-computed metrics (wpm, filler count, seconds),
unverified resume claims, topics already covered. Output:
```json
{
  "scores": {"communication": 6, "technical": 8, "problem_solving": 7, "answer_quality": 6},
  "evidence": {"communication": "\"so basically, um, it's like...\"", "technical": "...", "problem_solving": "...", "answer_quality": "..."},
  "feedback": "Name the trade-off before the solution.",
  "missing_points": ["writes get slower with more indexes"],
  "touched_claim": null,
  "candidates": {
    "harder": "Now design it for ten million users.",
    "follow_up": "What happens to writes with that index?",
    "easier": "Start with: what is an index for?",
    "new_topic": "Tell me about a time you disagreed with a teammate."
  }
}
```
Generating all candidates in the same call means **no second LLM round-trip** — lower latency and half the API calls (rate limit ≈40 RPM).
Communication is grounded in the measured metrics so it is not pure LLM opinion.

### 4.3 Adaptive engine — plain code, `engine/adaptive.py`
```
avg = mean(scores)
if unverified resume claim fits the topic and none probed yet  → resume_probe ("You mentioned X — why X over Y?")
elif avg >= 8                                                 → harder (difficulty +1, max 5) or new_topic if topic done
elif avg >= 5 and last move was not a follow_up               → follow_up on missing_points
elif avg < 5                                                  → easier (difficulty −1, min 1), log topic as a gap
else                                                          → new_topic
stop after N questions (8–12, default 8; demo uses 4)
```
Store the decision on the turn (`decision` json) — the report and the deck's "adaptive" claim both rely on it being visible.

### 4.4 Session report — `deep`, once per session
Input: all turns with scores and evidence. Output:
```json
{
  "averages": {"communication": 6.5, "technical": 7.8, "problem_solving": 7.0, "answer_quality": 6.0},
  "weakest": "answer_quality",
  "strengths": ["..."],
  "top_fixes": ["Use STAR — project answers skipped the Result.", "...", "..."],
  "model_answers": [{"question": "...", "stronger_answer": "..."}],
  "next_session": {"difficulty": "medium", "topics": ["behavioural STAR", "database indexing"], "count": 5}
}
```
Averages are computed in code (not by the LLM) and passed in; the LLM writes the prose.

### 4.5 Fella, the assistant — `fast`
Context assembled in SQL (MVP, no vectors): profile review summary, last report, the 3 lowest-scoring turns (question, answer, evidence), last 10 chat messages.
Capabilities: explain a score, quiz on a gap, rewrite resume bullets for a pasted JD, answer "how do I…" about the app.
Fella replies in **plain text** (in chat the model drifts out of JSON); an optional last line `QUIZ: question | topic` is parsed into `quiz`. API returns `{user, assistant: {content, quiz}}`. Stretch: embed resume/turns and retrieve by similarity (would need Postgres + pgvector).

### 4.7 LinkedIn profile review — `deep` (exists: `routers/linkedin.py`, `prompts/linkedin_review.py`)
Source: the **public page** from the pasted link (headline, About, titles/companies/dates, education; no job descriptions or skills)
or LinkedIn's **Save to PDF** export (everything). LinkedIn hides some profiles from logged-out visitors and blocks repeated fetches
(HTTP 999), so the UI always offers the PDF upload. Output: 1–10 per section (skills null when not visible), strengths, top 3 fixes,
3 headline options, About rewrite, missing keywords; plus code-checked items (custom URL, About length, …). Overall /100 is a weighted
mean computed in code. Rewrites may not invent facts: unknowns become `[placeholders]`.

### 4.8 Career graph — plain code + optional `fast` extraction (exists: `career.py`, `routers/career.py`)
Y = seniority ladder 0 Student · 1 Intern · 2 Entry · 3 Mid · 4 Senior · 5 Lead/Manager · 6 Head/Director, guessed from the title by keyword
rules (user can override). Second line = salary, monthly stipends ×12, shown in LPA. At each date the graph takes the highest active level,
so gaps fall back to education (level 0): that's where the "downs" come from. LinkedIn import: public page is already structured;
PDF goes through `prompts/linkedin_extract.py`. LinkedIn never has salaries.

### 4.9 Advice (learning roadmaps) — `fast`, plain text (exists: `routers/advice.py`, `prompts/advice.py`, `/advice` page)
A dedicated chat (separate `channel="advice"` history from the Fella drawer). The user states a goal role or topics; Fella
replies with Goal / Phase 1-3 (weeks) / Build / Today, tailored to their profile gaps and weakest interview area.
Resources come ONLY from `app/learning_catalog.json` (64 free courses, guides, practice sites, roadmap.sh roadmaps and
YouTube channels; every URL checked on 2026-10-23, YouTube handles confirmed by 404-on-fake test). The model cites them as
`[[R:id]]` (or YouTube searches `[[YT:words]]`); the backend swaps markers for `[n]` refs + numbered resource cards and drops
any raw URL, so no link is ever invented. Re-check catalog links before the demo (overthewire.org was briefly down).

### 4.6 Communication metrics — `engine/metrics.py`
`wpm = words / (answer_seconds / 60)`; filler count via regex over `um|uh|like|basically|actually|you know|sort of`; answer length band.
Pass these numbers into §4.2.

---

## 5. Frontend

Pages (App Router): `/` landing · `/login` (pick one of the demo accounts; no password) · `/linkedin` (review, **exists**) · `/onboarding` (resume upload → review card) · `/setup` (4-pick wizard + voice/text toggle) ·
`/interview/[id]` (interview room) · `/report/[id]` · `/dashboard` (career graph **exists**; sessions + trend chart to add). A floating **Fella** button opens the assistant drawer on every signed-in page.

**Interview room states:** `speaking` (interviewer audio + waveform) → `listening` (mic on, push-to-talk or tap-to-stop) → `thinking` (spinner; target < 5 s) → next question.
Show the question as text too. Per-turn scores stay hidden until the report (like a real interview); a toggle can reveal them for the demo.

**Audio utilities (`lib/audio.ts`):** record with `MediaRecorder`, decode with `AudioContext.decodeAudioData`, downmix to mono, resample to 16 kHz with `OfflineAudioContext`,
encode 16-bit PCM WAV (≈40 lines). Playback: fetch WAV → `<audio>`; if the TTS request fails or takes > 2 s, speak with `window.speechSynthesis` instead.

**Design — decided: iOS-style "liquid glass" tiles in a light Miami purple, light + dark.** (Started from a neumorphism
reference on Pinterest; replaced at the user's request.) Tiles are translucent purple glass (`--glass-tint`, tuned per mode so
they look the same on white and on black), heavy `backdrop-filter` blur + saturation, a bright specular rim (top-left, catching
again bottom-right) and an inner lens glow. Page = white (light) / AMOLED black (dark) with soft drifting purple/pink/cyan
glows behind (`body::before`) so the glass has something to bend. Each tile re-declares the colour tokens for its content
(white text, light chart colours, Miami-pink buttons), so components only use `var(--fg)` etc. Utilities in
`frontend/src/app/globals.css`: `neu` (tile), `neu-inset` (recessed pane), `neu-btn` (glass pebble; frosted white inside a
tile), `btn-primary`, `field`, `label`. Theme = `<html data-theme>`, toggle saved in localStorage, defaults to the OS.
Ink: light mode = near-black text and dark accents on the glass; dark mode = white text. Tiles are see-through enough to
pick up the glows behind them.
Charts (`components/charts/flow.tsx`): thick 5 px gradient lines that fade in/out, smooth curves, no dots, a pulsing dot on
hover, faint vertical year guides, current year in pink; palettes from the theme (logo gradient, Miami pink, cyan, indigo).
Phones: logo + account at the top, navigation in a floating glass tab bar; Fella's button is top-right everywhere. Brand inputs:
| Token | Value |
|---|---|
| Dark background | `#10102A` |
| Brand purple ("Fella.") | `#AE02EE` |
| Logo gradient | `#BB03F1 → #9D0FE1 → #7F2FDE` |
| Brand font | Outfit (SemiBold for the wordmark) |
| Main logo / app icon | `logos/01-chat/` |
| Assistant icon | `logos/05-fella/` |
| Miami accents | pink `#E8329C` / `#FF5CBF` (dark), cyan `#0AA5C6` / `#2FD6F0` (dark) |
No component kit; plain Tailwind + the utilities above.

---

## 6. Build order

Each phase ends with something demo-able. Owners are a **suggestion** — swap freely.

### Phase 0 — setup (first hour of next session)
- [x] Get an API key at build.nvidia.com; `copy .env.example .env`; paste `NVIDIA_API_KEY`.
- [x] `cd backend && ..\.venv\Scripts\python -m scripts.smoke_test` → pick `NIM_MODEL_FAST` / `NIM_MODEL_DEEP` from the printed list; rerun until TTS + ASR pass.
      ASR: the hosted Parakeet endpoint is **streaming-only**; `speech.transcribe` streams the whole WAV (offline calls fail with "Unavailable model … type=offline").
      If chat returns **401** while the model list works, the account lacks the public-endpoint entitlement (seen on NVIDIA's forums) — try a fresh key / another model.
- [x] Verify the TTS/ASR function IDs on each model's build.nvidia.com API tab (values in `.env.example` come from public docs).
- [x] Scaffold frontend (Next 16.4, Tailwind 4, `cacheComponents` on; read `frontend/AGENTS.md`): `npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
- [ ] `git init` is done; first commit after the key is **not** in any file.
- **Done when:** smoke test all PASS, `GET /health` shows models + speech configured, Next.js dev server runs.

### Phase 1 — core loop, text mode (owner: Rounak backend · Jaron frontend)
- [x] `db.py`, `models.py`, create tables on startup; demo accounts seeded on startup (`users.py`, no auth).
- [x] `POST /sessions` → first question (LLM, fallback bank on failure).
- [x] `POST /sessions/{id}/answer` (text) → §4.2 evaluation → §4.3 decision → next question; persist turns.
- [x] `POST /sessions/{id}/finish` → §4.4 report.
- [x] Frontend: account picker, theme toggle, app shell.
- [x] Frontend: setup wizard, text interview room, report page with Recharts bars.
- **Done when:** a full 4-question text interview produces a stored report on screen.

### Phase 2 — intelligence (owner: Manjunath voice · Rounak AI · Jaron UI)
- [x] Voice: `lib/audio.ts` WAV capture → `/answer` with audio → `speech.transcribe`; question audio via `speech.synthesize` (cache WAVs on disk by turn).
- [x] Browser `speechSynthesis` fallback + 2 s timeout.
- [x] Resume upload + AI Profile Review page; feed `resume_claims` and `interview_plan` into sessions.
- [x] Adaptive engine visible: label each question "follow-up" / "harder" / "verifying your resume".
- [x] Fella drawer + `/assistant/chat` with SQL-assembled context.
- [x] LinkedIn profile review (§4.7) — backend + `/linkedin` page.
- [x] Career graph (§4.8) — backend, LinkedIn import, dashboard chart with salary line; seeded for Jaron and Rounak.
- **Done when:** the demo story (§1) runs end to end by voice.

### Phase 3 — polish and demo (everyone)
- [x] Dashboard + `/progress` trend chart; study plan from `next_session` + gaps.
- [x] Demo seed for Jaron (`app/demo_data.py`, on account creation): resume, reviewed profile, 2 past sessions 47 → 72, Fella greeting.
- [ ] Pre-generate and cache audio for the scripted demo questions (no network dependency mid-demo).
- [ ] Final UI design pass (§5); empty/loading/error states; mobile check.
- [ ] Rehearse the 3-minute demo twice; record a backup screen capture.
- **Done when:** demo runs twice in a row without touching the keyboard except to answer.

### Stretch (only after Phase 3)
pgvector retrieval for Fella (move to Postgres) · real sign-in · streaming ASR for live captions · per-company question packs · video cues (eye contact/posture) · Hindi / regional-language interviews (Magpie supports Hindi).

---

## 7. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Free tier ≈40 req/min **per API**, limited credits | `ratelimit.py`: per model / speech-function budget of `NVIDIA_RPM_LIMIT` (36), calls wait for a slot (LLM ≤25 s, ASR ≤20 s, TTS ≤3 s then browser TTS) and 503 `busy` beyond that; 429/5xx retried with backoff; OpenAI client retries off so every attempt counts. `cache.py`: identical LLM calls and TTS text are served from `backend/tmp/cache` (rehearsals cost nothing). One uvicorn worker only. `/health` shows budget use |
| Nemotron 3.x reasons by default and returns empty content (`finish=length`) | `chat_json` sends `chat_template_kwargs.enable_thinking=false` (≈9 s vs 35 s+). `/no_think` and `reasoning_effort` do not work |
| Throttling / slow hosted TTS during the live demo | 2 s timeout → `speechSynthesis`; pre-cached demo audio |
| LLM returns bad JSON or slow reasoning | `parse_json` + one retry + fallback bank; no-reasoning switch; tight `max_tokens` |
| ASR mishears accents | Show transcript, allow "edit and resend" in text |
| Function IDs / model IDs change | All in `.env`; smoke test catches it in seconds |
| Browser mic permissions on demo laptop | Test in the exact browser beforehand; text mode as backup |

## 8. Testing
- `scripts/smoke_test.py` before every work session and before the demo.
- Unit tests (pytest, `backend/tests`): `test_ratelimit.py` exists. Add `adaptive.py`, `metrics.py`, `parse_json` — pure functions, cheap to cover.
- One scripted end-to-end run (text mode) that asserts a report exists — run after every backend change.

## 9. Open questions
1. Hackathon date and duration, and judging criteria? (Sets how much of Phase 3 and stretch is realistic.)
2. Is a hosted deployment required, or is a local demo on a laptop acceptable?
3. UI design direction beyond "modern, sleek" — light or dark first, any reference apps?
4. Which Nemotron models (decide from the smoke-test list; measure latency per turn).
5. Keep the assistant's name "Fella"?

## 10. Verify before relying on
- Nemotron model IDs available to the key (smoke test lists them).
- TTS function ID `877104f7-…` (magpie-tts-multilingual) and ASR function ID `d8dd4e9b-…` (parakeet-ctc-0.6b-asr) — sources disagree on some IDs.
- Whether Riva ASR accepts the browser's 16 kHz WAV directly (smoke test round-trips a 22.05 kHz TTS file).
- Free-tier limits on your account dashboard.

Sources used for the NVIDIA details: build.nvidia.com model pages (Nemotron 3.5 Super VL, Parakeet CTC 0.6B ASR), the Magpie TTS Multilingual
model card on Hugging Face, NVIDIA developer-forum threads on rate limits and 401 errors.
