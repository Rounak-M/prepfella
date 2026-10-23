import type { CareerEntry } from "./api";

// Time as fractional years (2025-07 → 2025.5) so Recharts can use a numeric x-axis.
export function toYears(date: string, edge: "start" | "end"): number {
  const [y, m] = date.split("-").map(Number);
  const month = m ?? (edge === "start" ? 1 : 12);
  return y + (edge === "start" ? month - 1 : month) / 12; // end is exclusive: end of that month
}

export function nowYears(): number {
  const d = new Date();
  return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365;
}

// `hold` points only shape the curve (they repeat the previous value just before a change) and get no dot.
// `gap` points fall between entries and carry the last level and pay forward.
export type GraphPoint = { t: number; level: number | null; lpa: number | null; roles: CareerEntry[]; hold?: boolean; gap?: boolean };

const EASE = 0.12; // years (~6 weeks) each change takes on the curve

/**
 * Series for the curved graph: a plateau per period with a short smooth transition at each change.
 * At every start/end boundary: seniority = highest level among active entries; salary = highest yearly salary in
 * lakhs, 0 while only studying, null when a role's pay is unknown or nothing is active (the line breaks there).
 */
export function careerSeries(entries: CareerEntry[]): GraphPoint[] {
  const points = boundaryPoints(entries);
  return points.flatMap((p, i) => {
    if (i === 0) return [p];
    const prev = points[i - 1];
    const hold = { ...prev, t: p.t - Math.min(EASE, (p.t - prev.t) / 2), hold: true };
    return [hold, p];
  });
}

function boundaryPoints(entries: CareerEntry[]): GraphPoint[] {
  if (!entries.length) return [];
  const now = nowYears();
  const spans = entries.map((e) => ({
    e,
    from: toYears(e.start, "start"),
    to: e.end ? toYears(e.end, "end") : Infinity, // "Present" stays active through the final point at `now`
  }));
  const times = [...new Set(spans.flatMap((s) => [s.from, s.to]).concat(now))]
    .filter((t) => t <= now)
    .sort((a, b) => a - b);
  let prev: GraphPoint | null = null;
  return times.map((t) => {
    const active = spans.filter((s) => s.from <= t && t < s.to).map((s) => s.e);
    // A gap between entries keeps the last level and pay, so the lines run on unbroken through the gap.
    if (!active.length && prev) return (prev = { ...prev, t, roles: [], gap: true });
    const working = active.filter((e) => e.kind !== "education");
    const salaries = working.map((e) => e.salary_yearly).filter((v): v is number => v != null);
    let lpa: number | null = null;
    if (salaries.length) lpa = Math.round((Math.max(...salaries) / 100000) * 10) / 10;
    else if (active.length && !working.length) lpa = 0; // studying only
    return (prev = { t, level: active.length ? Math.max(...active.map((e) => e.level)) : null, lpa, roles: active });
  });
}

/** Timeline order, strictly by date: earliest start first; on the same start, education first, then the shorter entry. */
export function byDate(a: CareerEntry, b: CareerEntry): number {
  const end = (e: CareerEntry) => (e.end ? toYears(e.end, "end") : Infinity);
  return (
    toYears(a.start, "start") - toYears(b.start, "start") ||
    Number(b.kind === "education") - Number(a.kind === "education") ||
    end(a) - end(b)
  );
}

export function formatYears(t: number): string {
  const y = Math.floor(t + 1e-6);
  const m = Math.round((t - y) * 12);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Math.min(m, 11)]} ${y}`;
}

export function formatRange(e: CareerEntry): string {
  const f = (d: string) => (d.includes("-") ? formatYears(toYears(d, "start")) : d);
  return `${f(e.start)} – ${e.end ? f(e.end) : "Present"}`;
}

export function formatSalary(e: CareerEntry): string | null {
  if (e.salary == null) return null;
  if (e.salary_period === "month") return `₹${e.salary.toLocaleString("en-IN")}/mo`;
  return `₹${(e.salary / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} LPA`;
}
