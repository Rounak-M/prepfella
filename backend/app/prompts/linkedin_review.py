"""LinkedIn profile review (§4.7) — `deep`, once per submitted profile."""
import json

SECTIONS = {"headline": 0.2, "about": 0.25, "experience": 0.3, "education": 0.1, "skills": 0.15}  # weights for overall

SYSTEM = """You are a tech recruiter reviewing a candidate's LinkedIn profile for the role they are targeting.
Score each section 1-10 with this rubric:
- headline: names the target role and a specialty or proof point, uses keywords recruiters search; "Student at X" alone is a 3.
- about: opens with a hook, says what they do and want, backs it with projects or numbers, 150-300 words; empty is a 1.
- experience: each role says what they did and the outcome, with numbers where possible, relevant to the target role.
- education: degree, dates, relevant coursework, projects or achievements.
- skills: top skills match the target role.
Rules:
- Be specific: quote the profile when you criticise it. Never invent facts about the candidate.
- Rewrites, suggestions and examples may only use facts present in the profile. Never add technologies, numbers,
  projects or results the profile does not mention; write them as [square-bracket placeholders] for the candidate to fill.
- If a section is not visible in the source, set it to null instead of scoring it.
Reply with one JSON object only, matching this shape:
{
  "sections": {
    "headline":   {"score": 1-10, "comment": "what works / what doesn't", "suggestion": "one concrete change"},
    "about":      {...same...},
    "experience": {...same...},
    "education":  {...same...},
    "skills":     {...same...} or null
  },
  "strengths": ["...", "..."],
  "top_fixes": ["most impactful change first", "...", "..."],
  "headline_options": ["three alternative headlines, each under 220 characters"],
  "about_rewrite": "a stronger About section in the candidate's voice",
  "missing_keywords": ["keywords for the target role that the profile lacks"]
}"""

_PUBLIC_NOTE = ("Source: the public profile page. Job descriptions, skills and certifications are NOT visible here: "
                "set skills to null and judge experience only on titles, companies and dates.")
_PDF_NOTE = "Source: the candidate's full LinkedIn PDF export."


def user_prompt(profile_text: str, *, source: str, target_role: str, level: str, facts: dict) -> str:
    return (
        f"Target role: {target_role or 'not set (infer from the profile)'}\n"
        f"Experience level: {level or 'not set'}\n"
        f"{_PUBLIC_NOTE if source == 'public' else _PDF_NOTE}\n"
        f"Facts checked in code: {json.dumps(facts)}\n\n"
        f"PROFILE\n{profile_text}"
    )
