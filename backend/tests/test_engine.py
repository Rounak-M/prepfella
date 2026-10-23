"""Adaptive rules (§4.3) and answer metrics (§4.6). Pure functions, no API calls."""
from app.engine import adaptive
from app.engine.metrics import answer_metrics

CANDIDATES = {
    "harder": "Design it for ten million users.",
    "follow_up": "What happens to writes with that index?",
    "easier": "What is an index for?",
    "new_topic": {"topic": "Teamwork", "question": "Tell me about a disagreement."},
    "resume_probe": "You mentioned Redis — why Redis over Memcached?",
}


def scores(v: float) -> dict:
    return dict.fromkeys(("communication", "technical", "problem_solving", "answer_quality"), v)


def decide(v, **kw):
    args = {"last_kind": "main", "difficulty": 3, "topic": "Indexing", "claim": None} | kw
    return adaptive.decide(scores(v), CANDIDATES, **args)


def test_strong_answer_goes_harder_and_raises_difficulty():
    d = decide(9)
    assert (d["move"], d["difficulty"], d["question"]) == ("harder", 4, CANDIDATES["harder"])


def test_two_strong_answers_in_a_row_move_to_new_topic():
    d = decide(9, last_kind="harder")
    assert (d["move"], d["kind"], d["topic"]) == ("new_topic", "main", "Teamwork")


def test_middling_answer_gets_one_follow_up_only():
    assert decide(6)["move"] == "follow_up"
    assert decide(6, last_kind="follow_up")["move"] == "new_topic"


def test_weak_answer_steps_down_but_not_below_one():
    assert decide(3)["move"] == "easier"
    assert decide(3, difficulty=1)["difficulty"] == 1


def test_resume_claim_takes_priority():
    d = decide(9, claim="Added Redis caching")
    assert d["move"] == "resume_probe" and "Redis" in d["reason"] and d["label"] == "Verifying your resume"


def test_missing_candidate_falls_back_to_new_topic():
    d = adaptive.decide(scores(3), {"new_topic": {"topic": "APIs", "question": "Design a REST API."}},
                        last_kind="main", difficulty=3, topic="Indexing", claim=None)
    assert (d["move"], d["question"]) == ("new_topic", "Design a REST API.")


def test_metrics_counts_fillers_and_pace():
    m = answer_metrics("Um so basically an index is like a lookup, you know, um yes " * 3, 30)
    assert m["filler_count"] == 15 and m["wpm"] == 78 and m["length"] == "concise"
    assert answer_metrics("short", None) == {"words": 1, "seconds": None, "wpm": None, "filler_count": 0, "length": "too short"}
