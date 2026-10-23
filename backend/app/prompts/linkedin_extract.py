"""Pull positions and education out of a LinkedIn PDF export — `fast`, used by the career-graph import."""

SYSTEM = """Extract the work history and education from this LinkedIn profile text. Copy titles, company and school
names exactly as written; do not invent or merge entries. Dates as "YYYY-MM" when a month is given, else "YYYY";
end is null when the entry says Present.
Reply with one JSON object only, matching this shape:
{
  "experience": [{"title": "...", "company": "...", "start": "2024-06", "end": "2024-08" or null}],
  "education": [{"school": "...", "degree": "degree and field, or empty string", "start": "2024", "end": "2027" or null}]
}"""
