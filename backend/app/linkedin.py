"""Get LinkedIn profile text: the public page (from a pasted link) or LinkedIn's "Save to PDF" export.

The public page only carries headline, About, job titles/companies/dates, education and location; job descriptions,
skills and certifications need the PDF. LinkedIn hides some profiles from logged-out visitors, and after a burst of
profile requests it blocks the whole IP for a while (HTTP 999, also for curl). So: every fetched profile is cached on
disk for a day, and callers offer the PDF upload whenever fetch_public_profile raises LinkedInUnavailable.
Before a demo, open the demo profiles once so they are cached.
"""
import html
import json
import re
import urllib.error
import urllib.request

import time

import pymupdf

from . import cache

# Accepts what people actually paste: country subdomains, /mwlite/, trailing /en or /details/..., tracking params.
_URL = re.compile(r"^(?:https?://)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com/(?:mwlite/)?in/([^/?#\s]+)", re.I)
_CACHE_SECONDS = 24 * 3600
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


class LinkedInUnavailable(Exception):
    def __init__(self, message: str, code: str = "linkedin_unavailable"):
        super().__init__(message)
        self.code = code  # linkedin_unavailable (private / sign-in wall) | linkedin_rate_limited (999)


def normalize_url(url: str) -> str:
    """Canonical https://www.linkedin.com/in/<slug>/ or ValueError."""
    m = _URL.match(url.strip())
    if not m:
        raise ValueError("Paste a profile link like https://www.linkedin.com/in/your-name")
    return f"https://www.linkedin.com/in/{m.group(1)}/"


def has_custom_url(url: str) -> bool:
    """LinkedIn's default slugs end in a generated id (e.g. jaron-d-4a1b2c3d5); a custom one does not."""
    slug = _URL.match(url).group(1)
    return not re.search(r"-[0-9a-f]{6,}$|-\d{3,}$", slug)


def fetch_public_profile(url: str) -> dict:
    k = cache.key("linkedin", url.lower())
    hit = cache.get_json("linkedin", k)
    if hit and time.time() - hit["fetched_at"] < _CACHE_SECONDS:
        return hit["profile"]
    profile = _parse(_download(url))
    cache.put_json("linkedin", k, {"fetched_at": time.time(), "profile": profile})
    return profile


def _download(url: str) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            final_url, page = resp.geturl(), resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        if e.code == 999:
            raise LinkedInUnavailable("LinkedIn is limiting profile requests from this network right now, or the "
                                      "profile is hidden from people who aren't signed in", "linkedin_rate_limited") from e
        if e.code == 404:
            raise LinkedInUnavailable("No LinkedIn profile at that link") from e
        raise LinkedInUnavailable(f"LinkedIn did not return the page (HTTP {e.code})") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise LinkedInUnavailable(f"Could not reach LinkedIn ({e})") from e
    if re.search(r"authwall|/login|/signup", final_url):
        raise LinkedInUnavailable("This profile is only visible to signed-in LinkedIn members")
    return page


def _parse(page: str) -> dict:
    person = None
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        data = json.loads(block)
        person = next((g for g in data.get("@graph", [data]) if g.get("@type") == "Person"), person)
    if person is None:
        raise LinkedInUnavailable("This profile is only visible to signed-in LinkedIn members")

    title = html.unescape(re.search(r"<title>(.*?)</title>", page, re.S).group(1)).removesuffix(" | LinkedIn")
    titles = person.get("jobTitle") or []
    titles = [titles] if isinstance(titles, str) else titles
    conn = re.search(r"(\d[\d,]*\+?) connections", page)

    def span(org: dict) -> str:
        role = org.get("member") or {}
        return f"{role.get('startDate', '?')} – {role.get('endDate', 'present')}"

    return {
        "name": person.get("name", ""),
        "headline": title.split(" - ", 1)[1] if " - " in title else "",
        "location": (person.get("address") or {}).get("addressLocality", ""),
        "about": html.unescape(person.get("description") or ""),
        "experience": [
            {"title": titles[i] if i < len(titles) else "", "company": o.get("name", "").strip(), "dates": span(o)}
            for i, o in enumerate(person.get("worksFor") or [])
        ],
        "education": [{"school": o.get("name", "").strip(), "dates": span(o)} for o in person.get("alumniOf") or []],
        "connections": conn.group(1) if conn else None,
    }


def is_masked(text: str) -> bool:
    """LinkedIn blurs fields for logged-out visitors by replacing every letter with '*'."""
    return "*" in text and not re.sub(r"[*\s]", "", text)


def public_profile_text(p: dict) -> str:
    lines = [f"Name: {p['name']}", f"Headline: {p['headline'] or '(none)'}", f"Location: {p['location'] or '(none)'}",
             f"About: {p['about'] or '(empty)'}", "Experience:"]
    lines += [f"- {e['title'] or '(no title)'} at {e['company']} ({e['dates']})" for e in p["experience"]] or ["- (none listed)"]
    lines += ["Education:"]
    lines += [f"- {e['school']} ({e['dates']})" for e in p["education"]] or ["- (none listed)"]
    if p["connections"]:
        lines.append(f"Connections: {p['connections']}")
    return "\n".join(lines)


def pdf_profile_text(pdf_bytes: bytes) -> str:
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        text = "\n".join(page.get_text() for page in doc)
    text = re.sub(r"\n\s*Page \d+ of \d+\s*\n", "\n", text).strip()
    if len(text) < 100:
        raise ValueError("That PDF has no readable text; export it again with LinkedIn's More → Save to PDF")
    return text[:15000]
