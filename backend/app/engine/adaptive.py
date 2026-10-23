"""Adaptive engine (§4.3): plain rules pick the next move from the turn's scores and the evaluator's candidates.
Kept out of the LLM so the behaviour is predictable and the "why" can be shown to the candidate."""

LABELS = {
    "resume_probe": "Verifying your resume",
    "harder": "Harder",
    "follow_up": "Follow-up",
    "easier": "Easier",
    "new_topic": "New topic",
}


def decide(scores: dict, candidates: dict, *, last_kind: str, difficulty: int, topic: str,
           claim: str | None) -> dict:
    """→ {"move", "kind", "question", "topic", "difficulty", "reason"}. `claim` = an unprobed resume claim the
    evaluator said this answer touched (or None)."""
    avg = sum(scores.values()) / len(scores)
    new = candidates.get("new_topic") or {}

    def move(name: str, question: str | None, reason: str, *, diff: int = difficulty, new_topic: str = topic) -> dict:
        return {"move": name, "kind": "main" if name == "new_topic" else name, "question": question, "topic": new_topic,
                "difficulty": max(1, min(5, diff)), "reason": reason, "avg": round(avg, 1)}

    if claim and candidates.get("resume_probe"):
        d = move("resume_probe", candidates["resume_probe"], f"You mentioned “{claim}” — checking the depth behind it.")
    elif avg >= 8 and last_kind != "harder":
        d = move("harder", candidates.get("harder"), f"Strong answer ({avg:.1f}/10), so the next one is harder.", diff=difficulty + 1)
    elif avg >= 8:
        d = move("new_topic", new.get("question"), "Topic covered well. Moving on.", diff=difficulty, new_topic=new.get("topic") or topic)
    elif avg >= 5 and last_kind != "follow_up":
        d = move("follow_up", candidates.get("follow_up"), f"Decent answer ({avg:.1f}/10) with gaps, so a follow-up digs into them.")
    elif avg < 5:
        d = move("easier", candidates.get("easier"), f"That one was tough ({avg:.1f}/10), so stepping back a level.", diff=difficulty - 1)
    else:
        d = move("new_topic", new.get("question"), "Moving to a new topic.", new_topic=new.get("topic") or topic)

    if not d["question"]:  # evaluator omitted that candidate: fall back to a new topic, then to anything it gave
        q = new.get("question") or next((v for v in candidates.values() if isinstance(v, str) and v), None)
        d.update(move="new_topic", kind="main", question=q, topic=new.get("topic") or topic)
    d["label"] = LABELS[d["move"]]
    return d
