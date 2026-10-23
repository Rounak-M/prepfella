import type { InterviewType, Report } from "./api";

export const TYPE_LABELS: Record<InterviewType, string> = { technical: "Technical", hr: "HR", mixed: "Mixed" };

export function formatDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", opts) : "";
}

/** /setup link prefilled from a report's next_session (topics are "|"-separated). */
export function nextSessionHref(next: Report["next_session"], fallbackType: InterviewType): string {
  const params = new URLSearchParams({
    type: next.type ?? fallbackType,
    difficulty: next.difficulty,
    count: String(next.count),
    topics: next.topics.join("|"),
  });
  return `/setup?${params}`;
}

// Colour per adaptive move, shared by the report timeline and question list.
export function moveTone(label: string | null | undefined): string {
  switch (label) {
    case "Harder":
      return "var(--primary)";
    case "Follow-up":
      return "var(--accent-cyan)";
    case "Easier":
      return "var(--accent-pink)";
    case "Verifying your resume":
      return "var(--success)";
    default:
      return "var(--muted)";
  }
}

/** 0–10 score → colour: weak pink, okay purple, strong green. */
export function scoreTone(score: number): string {
  return score < 5 ? "var(--accent-pink)" : score < 7.5 ? "var(--primary)" : "var(--success)";
}
