"""Interview prompts: the opening question, and the per-answer evaluation + next candidates (§4.2, one call per turn)."""
import json

_DIFF = {1: "very easy", 2: "easy", 3: "medium", 4: "hard", 5: "very hard"}

OPENING_SYSTEM = """You are a friendly but rigorous interviewer starting a mock interview.
Ask ONE opening question: spoken aloud, under 35 words, no preamble, no numbering.
For technical or mixed interviews open with a technical question on the first planned topic; for hr open with a
behavioural one. Match the difficulty and the candidate's level.
Reply with one JSON object only: {"topic": "short topic name", "question": "..."}"""


def opening_user(*, role: str, level: str, kind: str, difficulty: int, topics: list[str], claims: list[str]) -> str:
    return (f"Role: {role}\nLevel: {level}\nInterview type: {kind}\nDifficulty: {_DIFF[difficulty]}\n"
            f"Planned topics: {', '.join(topics) or 'pick suitable ones for the role'}\n"
            f"Resume claims (don't probe yet): {json.dumps(claims)}")


EVAL_SYSTEM = """You are an interviewer scoring one answer in a mock interview, then preparing the next question.
Score 1-10 on: communication, technical, problem_solving, answer_quality.
- communication: clarity and structure; use the measured metrics (words per minute ~120-160 is natural, many fillers
  hurt, "too short" answers hurt).
- technical: correctness and depth for the role and level. For behavioural questions, judge domain understanding shown.
- problem_solving: reasoning, trade-offs, handling of constraints.
- answer_quality: did it actually answer the question; for behavioural questions, STAR (situation, task, action, result).
evidence: for EACH dimension quote a short phrase from the answer (in quotes) and say why it earned the score.
If the answer is empty or off-topic, score low and say so. Be fair to a candidate of the stated level.
Candidate next questions, each spoken aloud, one sentence, under 35 words:
- harder: same topic, one step harder.
- follow_up: digs into what the answer missed (use missing_points).
- easier: same topic, simpler, to rebuild confidence.
- new_topic: a different planned topic not yet covered.
- resume_probe: only if the answer relates to one of the unverified resume claims, a question testing the depth of
  that claim ("You mentioned X — why X over Y?"); otherwise null. touched_claim = that claim's exact text, else null.
Reply with one JSON object only, matching this shape:
{
  "scores": {"communication": 6, "technical": 8, "problem_solving": 7, "answer_quality": 6},
  "evidence": {"communication": "\\"so basically, um...\\" — filler-heavy opening", "technical": "...", "problem_solving": "...", "answer_quality": "..."},
  "feedback": "one sentence: the single most useful fix",
  "missing_points": ["..."],
  "touched_claim": null,
  "candidates": {
    "harder": "...", "follow_up": "...", "easier": "...",
    "new_topic": {"topic": "...", "question": "..."},
    "resume_probe": null
  }
}"""


def eval_user(*, role: str, level: str, kind: str, difficulty: int, question: str, topic: str, answer: str,
              metrics: dict, claims: list[str], covered: list[str], planned: list[str]) -> str:
    return (f"Role: {role}\nLevel: {level}\nInterview type: {kind}\nCurrent difficulty: {_DIFF[difficulty]}\n"
            f"Topic: {topic}\nQuestion: {question}\n"
            f"Measured metrics: {json.dumps(metrics)}\n"
            f"Unverified resume claims: {json.dumps(claims)}\n"
            f"Topics covered so far: {json.dumps(covered)}\nPlanned topics: {json.dumps(planned)}\n\n"
            f"ANSWER (transcript):\n{answer.strip() or '(no answer)'}")
