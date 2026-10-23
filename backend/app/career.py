"""Career graph: entries on a seniority ladder (y-axis) over time, plus an optional salary line."""
import re

LEVELS = {0: "Student", 1: "Intern", 2: "Entry level", 3: "Mid level", 4: "Senior", 5: "Lead / Manager", 6: "Head / Director"}

# Checked top-down; first match wins. Plain keyword rules so the level is predictable and the user can override it.
_RULES = [
    (6, r"\b(head|director|vp|vice president|chief|cto|ceo|cfo|coo|founder|co-?founder|chair|co-?chair|partner|principal)\b"),
    (5, r"\b(lead|manager|architect|staff)\b"),
    (4, r"\b(senior|sr)\b"),
    (1, r"\b(intern|internship|trainee|apprentice)\b"),
    (0, r"\b(student|participant|volunteer)\b"),
    (2, r"\b(junior|jr\.?|associate|graduate|fresher|entry|assistant)\b"),
]


def guess_level(title: str, kind: str) -> int:
    if kind == "education":
        return 0
    if kind == "internship":
        return 1
    t = title.lower()
    for level, pattern in _RULES:
        if re.search(pattern, t):
            return level
    return 3  # a plain "Software Engineer" / "Data Analyst" title


def guess_kind(title: str) -> str:
    return "internship" if re.search(r"\b(intern|internship|trainee|apprentice)\b", title, re.I) else "job"


def normalize_date(value) -> str | None:
    """'2024', 2024, 'Jun 2024', 'June 2024', '2024-06', 'Present' → 'YYYY' / 'YYYY-MM' / None."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or re.fullmatch(r"(?i)present|current|now|\?", s):
        return None
    if m := re.fullmatch(r"(\d{4})(?:-(\d{1,2}))?", s):
        return f"{m.group(1)}-{int(m.group(2)):02d}" if m.group(2) else m.group(1)
    months = "jan feb mar apr may jun jul aug sep oct nov dec".split()
    if m := re.fullmatch(r"([A-Za-z]{3})[a-z]*\.?\s+(\d{4})", s):
        if m.group(1).lower() in months:
            return f"{m.group(2)}-{months.index(m.group(1).lower()) + 1:02d}"
    if m := re.search(r"\d{4}", s):
        return m.group(0)
    return None


def yearly_salary(amount: float | None, period: str) -> float | None:
    if amount is None:
        return None
    return amount * 12 if period == "month" else amount
