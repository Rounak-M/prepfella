"""Communication metrics computed in code (§4.6), passed to the evaluator so scoring isn't pure LLM opinion."""
import re

_FILLERS = re.compile(r"\b(um+|uh+|erm|like|basically|actually|you know|sort of|kind of|i mean)\b", re.I)


def answer_metrics(text: str, seconds: float | None) -> dict:
    words = len(text.split())
    fillers = len(_FILLERS.findall(text))
    wpm = round(words / (seconds / 60)) if seconds and seconds >= 3 else None
    band = "too short" if words < 25 else "concise" if words < 120 else "detailed" if words < 250 else "long-winded"
    return {"words": words, "seconds": round(seconds, 1) if seconds else None, "wpm": wpm, "filler_count": fillers, "length": band}
