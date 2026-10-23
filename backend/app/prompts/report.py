"""Session report (§4.4) — `deep`, once per session. Averages and the weakest dimension are computed in code."""
import json

SYSTEM = """You are an interview coach writing the end-of-interview report for a candidate.
You get every question, the candidate's answer, per-dimension scores with evidence, and averages computed in code.
Be concrete: refer to specific answers. Never invent things the candidate said.
- strengths: 2-3 things they did well, each tied to an answer.
- top_fixes: exactly 3, most impactful first, each actionable ("Use STAR — your project answer skipped the Result").
- model_answers: for the 1-2 weakest answers, a stronger answer in the candidate's voice (under 120 words each),
  using only facts they gave or [placeholders].
- next_session: the practice session to do next, aimed at the weakest dimension and gap topics.
- study_plan: 3-4 short study tasks for the coming week.
Reply with one JSON object only, matching this shape:
{
  "summary": "two sentences",
  "strengths": ["..."],
  "top_fixes": ["...", "...", "..."],
  "model_answers": [{"question": "...", "stronger_answer": "..."}],
  "next_session": {"difficulty": "easy|medium|hard", "topics": ["..."], "count": 5, "type": "technical|hr|mixed"},
  "study_plan": [{"task": "...", "why": "..."}]
}"""


def user_prompt(*, role: str, level: str, kind: str, averages: dict, weakest: str, turns: list[dict], gaps: list[str]) -> str:
    return (f"Role: {role}\nLevel: {level}\nInterview type: {kind}\n"
            f"Averages (computed): {json.dumps(averages)}\nWeakest dimension: {weakest}\nGap topics: {json.dumps(gaps)}\n\n"
            f"TURNS\n{json.dumps(turns, indent=1)[:14000]}")
