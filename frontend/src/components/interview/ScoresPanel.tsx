import { DIMENSION_LABELS, DIMENSIONS, type Turn } from "@/lib/api";

/** The last answer's four scores + feedback. Hidden by default in the room, like a real interview. */
export function ScoresPanel({ turn }: { turn: Turn | null }) {
  if (!turn?.scores) {
    return <p className="text-sm text-[var(--muted)]">Scores appear here after your first answer.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="truncate text-xs text-[var(--muted)]">Q{turn.idx + 1}: {turn.question}</p>
      {DIMENSIONS.map((d) => (
        <div key={d}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{DIMENSION_LABELS[d]}</span>
            <span className="tabular-nums text-[var(--muted)]">{turn.scores![d]}/10</span>
          </div>
          <div className="neu-inset h-2.5 rounded-full p-0.5">
            <div className="h-full rounded-full bg-[image:var(--primary-gradient)] transition-[width] duration-500" style={{ width: `${turn.scores![d] * 10}%` }} />
          </div>
        </div>
      ))}
      {turn.feedback && (
        <p className="mt-1 text-sm">
          <b className="text-[var(--primary)]">Tip:</b> {turn.feedback}
        </p>
      )}
    </div>
  );
}
