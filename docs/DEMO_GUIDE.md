# PrepFella: how it works inside (demo prep guide)

For Jaron, Rounak and Manjunath. Read it once end to end, then use sections 8 and 9 to drill each other before the demo.
Every claim below matches the code as of 2026-10-23; file links point at where to look if a judge asks you to show it.

\---

## 1\. The 20-second version

PrepFella is an AI mock interviewer. You pick a role, level, interview type and difficulty, then answer out loud (or by typing).
After **every** answer the AI scores you on four dimensions, quoting your own words as evidence, and a rules engine decides
what to ask next: harder, a follow-up, easier, a new topic, or a question that checks a claim on your resume.
At the end you get a report with three fixes, stronger model answers and a planned next session.
Around that core: an AI resume review, an AI LinkedIn review, a career graph, a coach chat (Fella) that knows your results,
and an Advice page that builds a learning roadmap from free resources we checked by hand.

**Pitch rule:** say "AI" or "the LLM" when presenting. NVIDIA Nemotron is named only on the last slide. In Q\&A it's fine to name it.

\---

## 2\. Starting the app

|Command (any terminal)|What it does|
|-|-|
|`run prep`|Starts backend (:8000) and frontend (:3000) in one window, opens the browser. Ctrl+C stops both.|
|`run prep -Prod`|Same, but builds the frontend first (\~20 s). Pages load instantly and the Next.js dev badge is gone. **Use this for the demo.**|
|`run prep -Reset`|Deletes `backend/prepfella.db` first, so the 3 demo accounts are reseeded clean. Can combine: `run prep -Prod -Reset`.|

`run prep` only exists on Rounak's laptop (`C:\\Users\\Asus\\.local\\bin\\run.cmd`). On any machine, double-click
[start.cmd](../start.cmd) or run `.\\start.ps1` from the repo folder. If the app is already running, it just opens the browser.

The "N" button bottom-left in dev mode is the **Next.js dev tools** menu (bundler, route info). It only appears in dev mode;
`-Prod` removes it.

\---

## 3\. Architecture

```
Browser (Next.js 16, React 19)            FastAPI backend (Python 3.12)                 NVIDIA hosted APIs (one API key)
──────────────────────────────            ─────────────────────────────                 ────────────────────────────────
Pages call the API directly  ──HTTP/JSON──► routers/\*  (X-User-Id header = who you are)
  lib/api.ts (fetch wrapper)                │
Mic → MediaRecorder → 16 kHz WAV ─────────► speech.transcribe ──gRPC──────────────────► Riva ASR (Parakeet CTC 0.6B)
                                            │
                                            llm.chat\_json / chat\_text ──HTTPS (OpenAI API)─► Nemotron FAST: interview turns, chat
                                            │                                              Nemotron DEEP: reviews, reports
<audio> ◄────────── WAV ─────────────────── speech.synthesize ──gRPC──────────────────► Magpie TTS (voice "Aria")
  (or browser speechSynthesis fallback)     │
                                            ├─ ratelimit.py  (≤36 calls/min per API, wait-then-retry)
                                            ├─ cache.py      (disk cache: backend/tmp/cache)
                                            └─ SQLite via SQLAlchemy (backend/prepfella.db)
```

|Layer|Choice|Why (judge-friendly answer)|
|-|-|-|
|Frontend|Next.js App Router + TypeScript + Tailwind 4, Recharts for charts|Modern React, fast to build, typed API contracts|
|Backend|FastAPI|Python is where the AI/speech SDKs are; automatic request validation with Pydantic|
|LLM|Nemotron via NVIDIA's OpenAI-compatible API|Two models: a small fast one for live turns, a big one where quality matters|
|Speech|Riva ASR + Magpie TTS over gRPC|Real speech-to-text and natural voice, same API key|
|DB|SQLite through SQLAlchemy|Zero setup for a demo; same models run on Postgres by changing `DATABASE\_URL`|
|Auth|None: three seeded demo accounts|Hackathon scope. Real sign-in is a post-hackathon item|

Models in use (`.env`): **FAST** = `nvidia/nemotron-3.5-lightning-30b-a3b`, **DEEP** = `nvidia/nemotron-3.5-super-vl-120b-a12b`.

### Repo map

```
backend/app/
  main.py            FastAPI app, CORS, /health, creates tables + seeds demo accounts on startup
  config.py          reads .env
  llm.py             chat\_json / chat\_text / try\_chat\_json: every AI call goes through here
  speech.py          synthesize (TTS) / transcribe (ASR)
  ratelimit.py       per-API budget + retries        cache.py   disk cache
  models.py          tables                          db.py      engine + session
  users.py           demo accounts, X-User-Id → current user
  demo\_data.py       Jaron's resume, review, two past interviews, Fella greeting
  engine/adaptive.py the next-question rules         engine/metrics.py  wpm, fillers, length
  prompts/\*.py       one file per AI job (system prompt + JSON shape)
  routers/\*.py       sessions, profile, linkedin, career, assistant (Fella), advice
  fallback\_bank.json static questions per role, used when the AI is unavailable
  learning\_catalog.json  64 free resources (checked URLs) for the Advice page
frontend/src/
  app/login          account picker          app/(app)/\*  signed-in pages (dashboard, setup, interview, report, ...)
  components/        AppShell (sidebar + Fella button), fella/, interview/, report/, dashboard/, charts/flow.tsx
  lib/api.ts         fetch wrapper + response types   lib/audio.ts  mic → WAV   lib/career.ts  graph maths
```

\---

## 4\. The core loop: one interview, step by step

This is the part judges are most likely to dig into. Learn it cold.

### 4.1 Setup → `POST /sessions` ([sessions.py](../backend/app/routers/sessions.py))

1. The setup wizard sends role, level, type (`technical`/`hr`/`mixed`), difficulty, mode (`voice`/`text`) and question count (3–8, default 4).
2. The backend loads your **profile review** (if you've done one) and pulls out its `interview\_plan` topics and
`resume\_claims` (things on your resume worth verifying).
3. **One FAST LLM call** writes the opening question on the first planned topic ([prompts/interview.py](../backend/app/prompts/interview.py)).
If the AI fails → a question from `fallback\_bank.json` for that role family.
4. The session row stores a `context` JSON: planned topics, claims, which claims were probed, gap topics, topics covered.
Difficulty is tracked as a number 1–5 (easy = 2, medium = 3, hard = 4).

### 4.2 The question is spoken ([voice.ts](../frontend/src/components/interview/voice.ts))

* The browser fetches `GET /sessions/{id}/turns/{idx}/audio`; the backend calls Magpie TTS and returns a WAV (cached on disk by the question text).
* If the audio isn't back within **2 seconds**, or TTS is busy, the browser speaks the question itself with `speechSynthesis`.
The interview never waits on the network for the voice.

### 4.3 You answer ([audio.ts](../frontend/src/lib/audio.ts))

* `MediaRecorder` records the mic (webm/opus). On stop, the browser decodes it and an `OfflineAudioContext`
downmixes to mono and resamples to **16 kHz**, then we hand-encode a 16-bit PCM WAV (the 44-byte header is written by hand).
* The WAV goes to `POST /sessions/{id}/answer` as multipart, with how many seconds you spoke.
* Text mode sends `text` instead. In voice mode you can switch a single turn to typing.

### 4.4 The backend processes the answer (`answer()` in [sessions.py](../backend/app/routers/sessions.py))

1. **Speech to text:** `speech.transcribe` streams the WAV to Riva ASR in 3,200-byte chunks (100 ms of audio each).
It streams because NVIDIA's hosted Parakeet endpoint only accepts streaming. If ASR fails → 503 `asr\_unavailable`, and the UI asks you to type that answer.
2. **Metrics in code** ([metrics.py](../backend/app/engine/metrics.py)): words, words-per-minute (only if ≥3 s),
filler count (um, uh, like, basically, actually, you know, sort of, kind of, I mean), length band
(<25 words "too short", <120 "concise", <250 "detailed", else "long-winded").
3. **ONE FAST LLM call** does two jobs at once ([prompts/interview.py](../backend/app/prompts/interview.py) `EVAL\_SYSTEM`):

   * scores 1–10 on **communication, technical, problem\_solving, answer\_quality**, each with a quoted phrase from your answer as evidence,
one-line feedback, and the points you missed;
   * writes **all the candidate next questions**: `harder`, `follow\_up`, `easier`, `new\_topic`, and `resume\_probe`
(only if your answer touched an unverified resume claim).
Generating every option in the same call means no second round-trip: lower latency and half the API usage.
The measured metrics go into the prompt, so the communication score is grounded in numbers, not just the model's opinion.
4. Scores are cleaned in code (rounded, clamped 1–10, missing → 5). An empty answer scores 1 everywhere.
5. **The adaptive engine picks the next move** (plain Python, not the LLM; [adaptive.py](../backend/app/engine/adaptive.py)).
`avg` = mean of the four scores. Rules, checked top to bottom:

|Condition|Move|Difficulty|
|-|-|-|
|Answer touched an unverified resume claim and the AI wrote a probe|**Verifying your resume** ("You mentioned X, why X over Y?")|same|
|avg ≥ 8 and the last question wasn't already "harder"|**Harder**|+1 (max 5)|
|avg ≥ 8 (again)|**New topic** (topic covered well)|same|
|5 ≤ avg < 8 and the last question wasn't a follow-up|**Follow-up** on what you missed|same|
|avg < 5|**Easier**, and the topic is logged as a **gap**|−1 (min 1)|
|anything else|**New topic**|same|

   Each decision is stored with a human-readable reason ("Decent answer (6.3/10) with gaps, so a follow-up digs into them").
That label shows above the next question, and the report shows the whole path.
If the chosen question is missing or was already asked → fallback bank.

6. **Why rules and not the LLM?** Predictable behaviour, explainable to the candidate, testable with unit tests
(`backend/tests/test\_engine.py`), and the LLM's only job is what it's good at: judging language and writing questions.
7. The turn is saved (transcript, seconds, wpm, fillers, scores, evidence, feedback, decision), the next question is created,
and the response tells the UI the next question or `done`.

Per-turn scores are **hidden by default** (like a real interview). The eye toggle in the interview room reveals them for the demo.

### 4.5 Finish → report (`finish()` in [sessions.py](../backend/app/routers/sessions.py), [prompts/report.py](../backend/app/prompts/report.py))

* **Computed in code:** per-dimension averages, the weakest dimension, overall score /100 (= 10 × mean of the four averages), gap topics.
* **One DEEP LLM call** writes the prose: summary, 2–3 strengths tied to specific answers, exactly 3 top fixes,
stronger model answers for the 1–2 weakest answers (using only facts you gave, or `\[placeholders]`),
the next session to do, and a 3–4 item study plan.
* If the AI is unavailable → a template report built from the stored per-turn feedback, so you always get a report.
* The report page also shows the **adaptive timeline** (what each question was asked as, and why).
* "Start next session" pre-fills the setup wizard from `next\_session`.

**API calls per interview of N questions:** 1 (opener) + N (one per answer) + 1 (report) LLM calls, plus N TTS and N ASR calls in voice mode.

\---

## 5\. The other features

### AI Profile Review ([profile.py](../backend/app/routers/profile.py), [prompts/profile\_review.py](../backend/app/prompts/profile_review.py))

Upload a resume PDF (text extracted with PyMuPDF) or paste text. One DEEP call returns role fit (strong/good/developing),
strengths, gaps, red flags with fixes, **2–4 resume claims to verify** and a **3–5 topic interview plan**.
The claims and plan feed straight into the interview (section 4.1): that's how questions become resume-aware.

### Fella, the coach drawer ([assistant.py](../backend/app/routers/assistant.py), [prompts/fella.py](../backend/app/prompts/fella.py))

* Before each reply, the backend assembles **your own data with SQL** (`user\_context`): profile review, number of interviews,
score trend, last report, your **3 lowest-scoring answers** with their evidence, career history, LinkedIn review.
Plus the last 10 chat messages. That's retrieval without a vector database (a vector DB is listed as a stretch goal).
* One FAST call, **plain text** (models drift out of JSON in conversation). Fella may end with `QUIZ: question | topic`,
which the backend parses into a quiz card. Markdown is stripped so the drawer shows clean text.
* Demo line: "Why did my indexing answer score low?" → it quotes your stored evidence and asks a quiz question.

### Advice page ([advice.py](../backend/app/routers/advice.py), [prompts/advice.py](../backend/app/prompts/advice.py))

* A separate chat (`channel="advice"`) that turns a goal ("I want to become a cloud engineer") into
Goal → Phase 1–3 (weeks) → Build (portfolio ideas) → Today (first step), tailored to your profile gaps.
* **The model never writes a URL.** We picked up to 28 relevant entries from `learning\_catalog.json` (64 free resources,
every link checked by hand) by tag-matching your goal, and the model may only cite them as `\[\[R:id]]`, or a YouTube search as
`\[\[YT:words]]`. The backend swaps each marker for `\[1]`, `\[2]`… and builds numbered resource cards; unknown ids and any raw
URL the model writes are deleted. So **no link shown can be hallucinated**. This is a strong point to make.

### LinkedIn review + import ([linkedin.py](../backend/app/linkedin.py), [routers/linkedin.py](../backend/app/routers/linkedin.py))

* Input: a profile link (we fetch the public page and parse its embedded JSON-LD) or LinkedIn's "Save to PDF" export.
* Logged-out LinkedIn pages hide job descriptions and skills, blur job titles (`\*\*\*\*\*\*\*`) and drop job dates.
After a burst of requests LinkedIn blocks the IP (HTTP 999). So fetched pages are cached for a day, and the UI always offers the PDF upload.
* **Code checks (not AI):** custom URL, headline says more than "Student", About ≥150 words, at least one role, 500+ connections.
* **DEEP call** scores headline / about / experience / education / skills 1–10 against a rubric, writes 3 headline options, an About
rewrite and missing keywords. Rewrites may not invent facts: unknowns become `\[placeholders]`.
Sections the source can't show are null. **Overall /100 is a weighted mean computed in code**
(experience 30%, about 25%, headline 20%, skills 15%, education 10%).
* **Import to career graph:** public page data is already structured (no AI). The PDF goes through one FAST extraction call.
Duplicates are skipped and blurred titles are skipped and counted (`hidden\_jobs`), and the dialog then asks for the PDF.

### Career graph ([career.py](../backend/app/career.py), [lib/career.ts](../frontend/src/lib/career.ts))

* Y axis = seniority ladder 0 Student · 1 Intern · 2 Entry · 3 Mid · 4 Senior · 5 Lead/Manager · 6 Head/Director,
guessed from the job title by keyword rules (user can override). Second line = salary in LPA (monthly stipend × 12).
* At each date the graph shows the **highest active level**. Gaps fall back to education (level 0), which is why the line has dips
(Jaron's TA job after freelancing is the deliberate example).

### Dashboard

Career graph, interview progress chart (`GET /progress`: per-dimension averages per finished interview), timeline, and "Next up"
(the last report's planned next session). Past interviews live on the Mock interview tab.

\---

## 6\. Reliability: why the demo doesn't fall over

The NVIDIA free tier allows about **40 requests per minute per API** (each model and each speech function counts separately).

|Mechanism|Where|What it does|
|-|-|-|
|Rate limiter|[ratelimit.py](../backend/app/ratelimit.py)|Sliding 60 s window, **36 calls/min per API** (headroom under 40). A call waits for a free slot instead of failing: up to 25 s for the LLM, 20 s for ASR, 3 s for TTS. Beyond that it raises `Busy` → HTTP 503 with a friendly message.|
|Retries|`ratelimit.call`|429 / 5xx / timeouts retried 3 times with exponential backoff (1 s, 2 s, 4 s + jitter). The OpenAI client's own retries are off, so every attempt is counted.|
|Disk cache|[cache.py](../backend/app/cache.py)|TTS audio cached by question text; resume review, LinkedIn review and LinkedIn extraction cached by exact input; LinkedIn pages cached 24 h. **Interview turns and reports are not cached**: every answer is unique and openers should vary.|
|JSON safety|`llm.parse\_json`, `try\_chat\_json`|Strips `<think>` blocks and code fences, extracts the first `{…}`. On bad JSON: one retry, then return None so the caller uses its fallback.|
|Fallbacks|sessions.py|Opener → question bank. Evaluation fails → neutral scores, next question from the bank. Report fails → template report. ASR fails → type the answer. TTS slow → browser voice.|
|Thinking off|`llm.chat\_text`|Nemotron 3.x "thinks" by default and can return empty content. `enable\_thinking=false` → \~9 s instead of 35 s+.|
|One worker|uvicorn|The budget lives in process memory, so we run exactly one server process.|

`GET http://localhost:8000/health` shows whether the key, models and speech are configured, and the calls spent per API in the last minute.

\---

## 7\. Data model ([models.py](../backend/app/models.py))

|Table|Holds|
|-|-|
|`users`|the 3 demo accounts (no passwords)|
|`profiles`|target role, level, resume text, AI review (JSON), LinkedIn text + review (JSON)|
|`sessions`|one interview: the 4 picks, mode, status, current difficulty, `context` (topics, claims, probed, gaps, covered), report (JSON)|
|`turns`|one question + answer: transcript, seconds, wpm, fillers, scores, evidence, feedback, decision (JSON)|
|`career\_entries`|jobs / internships / education with level and optional salary|
|`assistant\_messages`|Fella and Advice chat history (`channel` = coach / advice), quiz, resources|

Flexible AI output lives in JSON columns. The fields we query on (user, status, dates, scores) stay structured.
"Who am I" = the `X-User-Id` header the frontend sends from localStorage; `users.current\_user` checks it on every request.
If the id is unknown (e.g. after a reset) the API returns 401 and the app sends you back to the account picker.

\---

## 8\. Demo run (≈3 minutes) and what's happening underneath

|You do|Underneath (say it if asked)|
|-|-|
|Pick **Jaron D**|`GET /users`; the id is saved in localStorage and sent as `X-User-Id`|
|Dashboard: career graph + score trend 47 → 72|Seeded by `demo\_data.py`; `/career`, `/progress`|
|Profile \& resume: show the review|Stored DEEP review; point at **resume claims** and **interview plan**|
|Mock interview: Backend Engineer · Fresher · Technical · Medium · Voice · 4 questions|`POST /sessions` → opener written from the plan|
|Answer by voice; give one weak answer|WAV 16 kHz → ASR → metrics → one LLM call → rules → "Follow-up" or "Easier" label|
|Mention Redis caching or the canteen API|Matches a resume claim → "Verifying your resume" question|
|Toggle the eye icon|Reveals per-turn scores + quoted evidence|
|Finish → report|Averages in code, prose from the DEEP model, adaptive timeline|
|Open Fella: "Why did my indexing answer score low?"|SQL-assembled context → grounded reply + quiz|
|(If time) Advice: "Roadmap to become a backend engineer"|Catalog-only links, `\[n]` references|

### Before the demo (checklist)

* \[ ] `run prep -Prod -Reset` on the demo laptop. Reset matters: Jaron currently has a **third interview from today scoring 25**
(a test run), which shows as a dip on the trend.
* \[ ] `cd backend; ..\\.venv\\Scripts\\python -m scripts.smoke\_test` → key, models, TTS, ASR all PASS.
* \[ ] Open the demo LinkedIn profiles once (caches them for 24 h). Keep the PDF export handy as the fallback.
* \[ ] Mic permission granted in the exact browser you'll use (Chrome or Edge). Text mode is the backup.
* \[ ] Do one full voice run-through; it warms the TTS cache for those questions.
* \[ ] Record a backup screen capture of a good run.

\---

## 9\. Questions judges are likely to ask

**"Is the scoring just the LLM's opinion?"**
Partly by design, but constrained. Every score must quote the answer as evidence. Communication is fed measured
numbers (words per minute, filler count, length). Averages, overall score, the weakest area and every adaptive decision are computed in code.

**"What makes it adaptive, concretely?"**
Section 4.4 step 5. The rules table, with the reason stored per question and shown in the report's timeline.

**"How do you stop hallucinated links / facts?"**
Advice links come only from our checked catalog via `\[\[R:id]]` markers; raw URLs are stripped. Rewrites (model answers,
LinkedIn About) may only use facts present in the input and must write `\[placeholders]` for anything unknown.

**"How is it resume-aware?"**
The profile review extracts claims and an interview plan. The opener uses the plan. Each evaluation checks whether the answer touched an
unverified claim, and if so the next question probes it, at most once per claim.

**"What about latency?"**
One LLM call per answer (scoring + all next-question options together), a small fast model for live turns, thinking mode off,
TTS cached and with a 2 s fallback to the browser voice.

**"What if the AI API goes down mid-interview?"**
Rate limiter waits, retries with backoff, then falls back: question bank, neutral scores, template report, typed answers, browser voice.
The interview never dead-ends.

**"Why SQLite / no login?"**
Hackathon scope. SQLAlchemy models are Postgres-ready (one connection string). Real sign-in is the first post-hackathon item.

**"Does it scale?"**
Not as-is: the rate budget is per process and the free tier caps us at \~40 calls/min per API. For production: paid NIM endpoints or
self-hosted NIM containers, Postgres, a shared rate limiter (e.g. Redis), real auth.

**"Why is Fella not RAG with embeddings?"**
The user's data is small and structured, so targeted SQL (weakest answers, last report) gives better grounding than similarity search.
Embeddings with pgvector are listed as a stretch goal.

**"What's next?"** (from the plan's stretch list)
Real sign-in, live captions with streaming ASR, company-specific question packs, video cues (eye contact, posture),
Hindi and regional-language interviews (Magpie TTS supports Hindi).

### Honest limitations (say them before a judge finds them)

* No authentication; accounts are demo accounts.
* LinkedIn's public page hides a lot when logged out, so the PDF export gives the full review.
* Free-tier rate limits: heavy parallel use would queue or return "busy".
* Per-turn scores come from one model call. They're consistent within a session but not calibrated against human graders.

### Who explains what (suggestion, from the plan's ownership)

* **Rounak:** backend, AI prompts, adaptive engine, rate limiting (sections 4.4–4.5, 6).
* **Jaron:** frontend, UI design (liquid glass theme), dashboard and charts, report page (sections 5 Dashboard / Career graph).
* **Manjunath:** voice pipeline: mic → WAV → ASR, TTS + browser fallback (sections 4.2–4.3).

\---

## 10\. Tests and debugging

* `cd backend; ..\\.venv\\Scripts\\python -m pytest tests`: 13 unit tests (adaptive engine rules, communication metrics, LinkedIn blurred-field detection, rate limiter under concurrent load and retries).
* `http://localhost:8000/docs`: FastAPI's interactive API docs (try any endpoint; set `X-User-Id: 1` for Jaron).
* `http://localhost:8000/health`: configuration + rate budget.
* Reset everything: `run prep -Reset` (DB). Clear AI/TTS/LinkedIn caches: delete `backend/tmp/cache`.

