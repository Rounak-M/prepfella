"""Fella's Advice mode — `fast`, plain text. A learning roadmap for a goal role or topics, citing only free resources from
learning_catalog.json by id ([[R:id]]) or YouTube searches ([[YT:query]]); the backend turns those into real links, so
the model never writes (or invents) a URL."""
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

from .fella import strip_markdown

CATALOG = json.loads((Path(__file__).resolve().parents[1] / "learning_catalog.json").read_text(encoding="utf-8"))["resources"]
_BY_ID = {r["id"]: r for r in CATALOG}
_GENERAL = ["cs50x", "fcc", "yt_fcc", "tih", "neetcode", "missing"]  # offered when nothing matches the goal

SYSTEM = """You are Fella in Advice mode: a practical, encouraging career mentor for students and early-career tech people
in India. The candidate tells you a goal role or topics they want to learn. Give them a plan they can start today.

Format (plain text, no markdown symbols like ** or #):
Goal: <one line restating their goal>

Phase 1 · Weeks 1-3: <focus>
- <what to learn or do> [[R:resource_id]]
- ...
Phase 2 · Weeks 4-8: <focus>
- ...
Phase 3 · ...(optional)

Build: <1-2 portfolio project ideas that prove the skills>
Today: <one concrete first step>

Rules:
- Cite learning resources ONLY as [[R:id]] using ids from the RESOURCE CATALOG below, 1-2 per bullet, best fit first.
  Prefer a mix of a course, a YouTube channel and hands-on practice. Never write a URL.
- For a specific topic with no good catalog entry, cite a YouTube search as [[YT:precise search words]], e.g.
  [[YT:postgres indexing explained]]. Use these sparingly.
- Tailor to their data (target role, level, skills and roles from their resume / LinkedIn text, gaps from their resume
  review, weakest interview area). Mention it briefly. If target_role is "(not set)", infer their field from what they
  entered; never assume a field their data doesn't show.
- All resources must be free. Keep the whole reply under 300 words.
- If the goal is unclear (e.g. just "hi"), ask one short question about their target role or topics instead of a plan.
- For a follow-up question, answer it directly; only give a full roadmap when they ask for one or state a new goal."""


def candidates(text: str, limit: int = 28) -> list[dict]:
    """Catalog entries whose tags appear in the goal text (plus profile hints), best matches first."""
    t = f" {text.lower()} "
    scored = []
    for r in CATALOG:
        score = sum(2 if f" {tag} " in t else 1 for tag in r["tags"] if tag in t)
        if score:
            scored.append((score, r))
    picked = [r for _, r in sorted(scored, key=lambda x: -x[0])][:limit]
    for rid in _GENERAL:
        if len(picked) >= limit:
            break
        if _BY_ID[rid] not in picked:
            picked.append(_BY_ID[rid])
    return picked


def catalog_block(entries: list[dict]) -> str:
    return "\n".join(f"{r['id']} | {r['title']} | {r['provider']} | {r['type']} | {', '.join(r['tags'][:6])}" for r in entries)


# [[R:id]], [[YT:query]], and the bare [[id]] the model sometimes writes instead
_MARK = re.compile(r"\[\[\s*(?:(R|YT)\s*:\s*)?([^\]]+?)\s*\]\]", re.I)
_URL = re.compile(r"\(?https?://\S+\)?")


def parse_reply(text: str) -> tuple[str, list[dict]]:
    """→ (reply with each marker replaced by a [n] reference, resources numbered in order of first mention). The UI
    shows the resources as numbered cards. Unknown ids and any raw URLs the model wrote are dropped, so every link
    shown is one we checked."""
    resources: list[dict] = []
    seen: dict[str, int] = {}

    def sub(m: re.Match) -> str:
        kind, value = (m.group(1) or "").upper(), m.group(2)
        if not kind:  # bare [[...]]: a catalog id, or else search words for YouTube
            kind = "R" if value.strip() in _BY_ID or " " not in value.strip() else "YT"
        if kind == "R":
            r = _BY_ID.get(value.strip())
            if r is None:
                return ""
            res = {k: r[k] for k in ("id", "title", "provider", "type", "url")}
        else:
            query = value.strip()
            res = {"id": f"yt:{query.lower()}", "title": query, "provider": "YouTube search", "type": "youtube",
                   "url": f"https://www.youtube.com/results?search_query={quote_plus(query)}"}
        if res["id"] not in seen:
            resources.append({**res, "n": len(resources) + 1})
            seen[res["id"]] = len(resources)
        return f" [{seen[res['id']]}]"

    text = _MARK.sub(sub, strip_markdown(text))
    text = _URL.sub("", text)
    text = re.sub(r"\](\s*,?\s*)\[", "] [", text)  # "[1], [2]" / "[1][2]" → "[1] [2]"
    text = re.sub(r"(,\s*)+(?=[,.\n]|$)", "", text)  # commas left by dropped markers
    text = re.sub(r"[ \t]+([,.;:)])", r"\1", re.sub(r"[ \t]{2,}", " ", text))
    return text.strip(), resources
