"""Made-up demo history for Jaron (main demo account): resume, profile review and two past interviews with rising
scores, so the dashboard trend, report pages and Fella have something real to show. Seeded once, on account creation."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .models import AssistantMessage, InterviewSession, Profile, Turn

RESUME = """Jaron D — Backend Engineer (Fresher) · Hubballi, Karnataka · jaron.d@example.com · github.com/jaron-d
EDUCATION
BCA, KLE Technological University (2024 – 2027) · CGPA 8.4
EXPERIENCE
Backend Engineering Intern, Finlytics (May 2026 – present): REST endpoints in FastAPI; pytest unit tests; fixed slow
report queries.
Freelance Web Developer (Aug – Dec 2025): websites for three local businesses.
PROJECTS
- Campus Canteen API — Flask + PostgreSQL REST API handling ~300 orders a day; added Redis caching for the menu.
- Expense Splitter — Python CLI with SQLite.
- PrepFella (Codefest 2026) — backend for an AI mock-interview app.
SKILLS
Python, FastAPI, Flask, SQL, PostgreSQL, Redis, Git, Docker (basic), Linux"""

REVIEW = {
    "role_fit": {"level": "good", "summary": "Solid fresher profile for backend roles: real APIs shipped with FastAPI and Flask, "
                                             "plus an internship. Depth on databases and system design is not yet visible."},
    "strengths": ["Hands-on API work in two frameworks (FastAPI, Flask)", "Current backend internship", "Caching used in a real project"],
    "gaps": ["Database internals (indexing, transactions)", "System design at scale", "Testing beyond unit tests"],
    "red_flags": [
        {"issue": "“fixed slow report queries” has no numbers", "fix": "Say what you changed and the speed-up, e.g. “added an index: 4 s → 300 ms”."},
        {"issue": "Freelance work doesn't say what you built", "fix": "Name the stack and one outcome per client."},
    ],
    "resume_claims": ["Added Redis caching for the canteen menu", "Fixed slow report queries at Finlytics", "Campus Canteen API handles ~300 orders a day"],
    "interview_plan": [
        {"topic": "Databases & indexing", "kind": "technical", "count": 2},
        {"topic": "API design", "kind": "technical", "count": 1},
        {"topic": "Caching", "kind": "technical", "count": 1},
        {"topic": "Teamwork (STAR)", "kind": "hr", "count": 1},
    ],
}

DIMS = ("communication", "technical", "problem_solving", "answer_quality")


def _turn(idx, kind, topic, diff, asked_as, q, a, secs, scores, evidence, feedback, label, reason):
    words = len(a.split())
    return dict(idx=idx, kind=kind, topic=topic, difficulty=diff, question=q, answer_text=a, answer_seconds=secs,
                wpm=round(words / (secs / 60)), filler_count=sum(a.lower().count(f) for f in (" um", " uh", " like ", "basically")),
                scores=dict(zip(DIMS, scores)), evidence=dict(zip(DIMS, evidence)), feedback=feedback,
                decision={"asked_as": asked_as, "move": label.lower().replace(" ", "_").replace("-", "_"), "label": label,
                          "reason": reason, "avg": round(sum(scores) / 4, 1), "missing_points": [], "ai": True})


SESSIONS = [
    {
        "days_ago": 14, "difficulty": "medium",
        "turns": [
            _turn(0, "main", "Databases & indexing", 3, "Opening question",
                  "What is a database index, and when could adding one make your application slower?",
                  "Um, an index is basically like a shortcut so the database finds stuff faster. I think it makes everything faster, "
                  "so I'd add one on every column we search.", 34, (4, 4, 3, 3),
                  ["“basically like a shortcut” — vague, filler-led", "“makes everything faster” — misses the write cost",
                   "No trade-off considered", "Doesn't answer when an index slows things down"],
                  "Name the cost: indexes speed up reads but slow down writes and use space.", "Easier",
                  "That one was tough (3.5/10), so stepping back a level."),
            _turn(1, "easier", "Databases & indexing", 2, "Easier",
                  "Without an index, how does the database find rows matching a WHERE clause?",
                  "It has to go through all the rows one by one and check each one, a full table scan, so it's slow for big tables.",
                  22, (6, 6, 5, 6),
                  ["Short and clear", "“full table scan” — correct term", "Links scan to table size", "Answers directly"],
                  "Good. Add what an index changes: a B-tree lookup instead of a scan.", "Follow-up",
                  "Decent answer (5.8/10) with gaps, so a follow-up digs into them."),
            _turn(2, "follow_up", "Databases & indexing", 2, "Follow-up",
                  "So what does an index change about that search, and what does it cost on inserts?",
                  "Uh, it keeps a sorted structure so it can jump to the rows. On insert it also has to update that structure, "
                  "so inserts are a bit slower I guess.", 30, (5, 6, 5, 5),
                  ["“uh … I guess” — hedging", "Sorted structure, insert cost — right idea", "Reaches the trade-off when prompted",
                   "Answers, but tentatively"],
                  "State trade-offs confidently, with one example.", "New topic", "Moving to a new topic."),
            _turn(3, "main", "Teamwork (STAR)", 3, "New topic",
                  "Tell me about a time you disagreed with a teammate. What happened?",
                  "In a college project my friend wanted to use MongoDB and I wanted Postgres. We argued and then just used Postgres.",
                  20, (5, 4, 4, 4),
                  ["Clear but very short", "No reasoning for Postgres given", "No resolution process", "Missing Task, Action and Result"],
                  "Use STAR: what you did to resolve it and how it turned out.", "Follow-up", "End of interview."),
        ],
        "report": {
            "summary": "You know the basics but answers were short and hedged. Database trade-offs only came out when prompted, "
                       "and the teamwork story skipped how you resolved the disagreement.",
            "strengths": ["Correctly described a full table scan", "Got to the index write cost on the follow-up"],
            "top_fixes": ["Lead with the trade-off: indexes speed reads but slow writes.",
                          "Use STAR — your teamwork answer had no Action or Result.",
                          "Cut fillers (“um”, “basically”) and hedges (“I guess”)."],
            "model_answers": [{"question": "Tell me about a time you disagreed with a teammate. What happened?",
                               "stronger_answer": "In our canteen project a teammate wanted MongoDB; I preferred Postgres because orders needed "
                                                  "transactions. I suggested we each list our must-haves, and we compared both on [criteria]. "
                                                  "We chose Postgres, and [result]. I learned to argue from requirements, not preference."}],
            "next_session": {"difficulty": "medium", "topics": ["Databases & indexing", "Teamwork (STAR)"], "count": 4, "type": "mixed"},
            "study_plan": [{"task": "Read how B-tree indexes work in PostgreSQL", "why": "Indexing was your weakest topic"},
                           {"task": "Write two STAR stories from your projects", "why": "Behavioural answers lacked structure"}],
        },
    },
    {
        "days_ago": 7, "difficulty": "medium",
        "turns": [
            _turn(0, "main", "Databases & indexing", 3, "Opening question",
                  "Your orders table is slow to filter by customer. What would you do?",
                  "First I'd check the query plan with EXPLAIN to confirm it's doing a sequential scan. Then I'd add an index on "
                  "customer_id. Reads get much faster, but every insert now updates the index too, which is fine because we read "
                  "far more than we write.", 38, (8, 8, 8, 7),
                  ["Structured: diagnose, fix, trade-off", "“EXPLAIN … sequential scan” — correct tooling",
                   "Weighs read/write ratio", "Answers fully; could quantify"],
                  "Add a number: how much faster, or how many rows.", "Harder", "Strong answer (7.8/10), so the next one is harder."),
            _turn(1, "harder", "Databases & indexing", 4, "Harder",
                  "Now orders are filtered by customer and sorted by date. One index or two?",
                  "One composite index on customer_id then created_at, so it can filter and return rows already sorted. Two "
                  "separate indexes wouldn't give the sort for free.", 30, (7, 7, 7, 7),
                  ["Concise", "Composite index, column order — correct", "Explains why one beats two", "Direct answer"],
                  "Mention column order matters: equality column first.", "Verifying your resume",
                  "You mentioned “Added Redis caching for the canteen menu” — checking the depth behind it."),
            _turn(2, "resume_probe", "Caching", 3, "Verifying your resume",
                  "You mentioned caching the canteen menu in Redis. How did you keep the cache from serving stale prices?",
                  "I set a five-minute TTL, and when the admin edits the menu the API deletes the menu key, so the next request "
                  "rebuilds it. Response time went from about 300 to 40 milliseconds.", 28, (8, 7, 7, 8),
                  ["Clear and specific", "TTL + invalidation on write — correct", "Considers freshness vs speed",
                   "“300 to 40 milliseconds” — quantified result"],
                  "Great. Mention what happens if Redis is down.", "New topic", "Topic covered well. Moving on."),
            _turn(3, "main", "Teamwork (STAR)", 3, "New topic",
                  "Tell me about a time you disagreed with a teammate.",
                  "In the canteen project a teammate wanted MongoDB. I wanted Postgres because orders needed transactions. I suggested "
                  "we list requirements first; transactions were a must, so we chose Postgres, and we had no order mix-ups at launch.",
                  33, (7, 6, 6, 7),
                  ["Situation and action are clear", "Transactions as the reason — sound", "Resolved via requirements",
                   "Has a result; could be measurable"],
                  "Quantify the result next time.", "Follow-up", "End of interview."),
        ],
        "report": {
            "summary": "Big step up: you diagnosed before fixing, quantified the caching result and used STAR. Next, push into "
                       "system design and failure cases.",
            "strengths": ["Diagnose → fix → trade-off structure on indexing", "Quantified the Redis caching win (300 → 40 ms)",
                          "Teamwork story now has an Action and a Result"],
            "top_fixes": ["Cover failure cases (what if Redis is down?).", "Quantify results in every story.",
                          "Practise one system-design question per week."],
            "model_answers": [],
            "next_session": {"difficulty": "hard", "topics": ["System design basics", "Caching failure modes"], "count": 5, "type": "technical"},
            "study_plan": [{"task": "Design a URL shortener end to end", "why": "System design is the next gap"},
                           {"task": "Read about cache stampedes and fallbacks", "why": "Your caching answers skip failure modes"}],
        },
    },
]


def seed_jaron(db: Session, user_id: int) -> None:
    p = db.get(Profile, user_id)
    p.resume_text, p.review = RESUME, REVIEW
    p.reviewed_at = datetime.now(timezone.utc) - timedelta(days=15)
    for spec in SESSIONS:
        start = datetime.now(timezone.utc) - timedelta(days=spec["days_ago"], hours=2)
        turns = [Turn(**t, created_at=start + timedelta(minutes=3 * t["idx"])) for t in spec["turns"]]
        averages = {d: round(sum(t.scores[d] for t in turns) / len(turns), 1) for d in DIMS}
        report = {**spec["report"], "averages": averages, "overall": round(10 * sum(averages.values()) / 4),
                  "weakest": min(averages, key=averages.get), "gaps": [], "ai": True,
                  "adaptive": [{"idx": t.idx, "question": t.question, "asked_as": t.decision["asked_as"],
                                "move_after": t.decision["label"], "reason": t.decision["reason"]} for t in turns]}
        s = InterviewSession(user_id=user_id, role="Backend Engineer", level="Fresher", interview_type="mixed",
                             difficulty=spec["difficulty"], mode="voice", status="finished", question_count=len(turns),
                             current_difficulty=turns[-1].difficulty, context={"topics": [], "claims": REVIEW["resume_claims"]},
                             started_at=start, ended_at=start + timedelta(minutes=14), report=report)
        db.add(s)
        db.flush()
        for t in turns:
            t.session_id = s.id
            db.add(t)
    db.add(AssistantMessage(user_id=user_id, role="assistant",
                            content="Hi Jaron! I'm Fella. Your last interview jumped from 47 to 72 — nice work. "
                                    "Ask me why any answer scored the way it did, or for a quick quiz on caching.",
                            created_at=datetime.now(timezone.utc) - timedelta(days=7)))
