"""Fella, the in-app coach (§4.5) — `fast`. Context is assembled in SQL (routers/assistant.py).
Plain-text replies: in conversation the model drifts out of JSON, so the quiz rides on an optional last line."""
import re

SYSTEM = """You are Fella, the friendly interview coach inside PrepFella. You talk to one candidate and you can see
their own data below (profile review, interview results, weakest answers, career history, LinkedIn review).
- Ground every answer in that data; quote their scores, evidence and answers when explaining something.
- If they ask why something scored low, explain using the stored evidence and say exactly how to fix it.
- When it helps learning, end with ONE short quiz question on their weakest topic, on its own last line exactly as
  "QUIZ: <question> | <topic>". If they are answering your previous quiz, grade it kindly, then optionally ask the next.
- You can also rewrite resume bullets, suggest LinkedIn headlines, or explain how to use the app
  (Profile → resume review; Mock interview → pick role, level, type, difficulty, voice or text; Report → scores and fixes;
  Dashboard → career graph; LinkedIn review).
- Keep replies under 140 words, warm and direct, plain text with short paragraphs or "-" bullets.
  No markdown: no **bold**, no *italics*, no `code`, no headings.
- If the data doesn't cover the question, say so instead of guessing."""

_QUIZ = re.compile(r"^\s*QUIZ:\s*(.+?)\s*(?:\|\s*(.+?))?\s*$", re.M | re.I)
_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__")
_ITALIC = re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])")


def strip_markdown(text: str) -> str:
    """Plain text for the chat UIs: no bold/italic/code/headings; "* item" bullets become "- item"."""
    text = _BOLD.sub(lambda m: m.group(1) or m.group(2), text)
    text = re.sub(r"^(\s*)\*\s+", r"\1- ", text, flags=re.M)
    text = _ITALIC.sub(lambda m: m.group(1), text)
    text = text.replace("`", "")
    return re.sub(r"^#+\s*", "", text, flags=re.M)


def parse_reply(text: str) -> tuple[str, dict | None]:
    """→ (reply without the QUIZ line and markdown, {"question", "topic"} or None). The drawer shows plain text."""
    text = strip_markdown(text)  # first: the model sometimes writes "**QUIZ:** …"
    quiz = None
    if m := _QUIZ.search(text):
        quiz = {"question": m.group(1).strip(), "topic": (m.group(2) or "").strip()}
        text = text[: m.start()] + "\n" + text[m.end():]
    return re.sub(r"\n{3,}", "\n\n", text).strip(), quiz
