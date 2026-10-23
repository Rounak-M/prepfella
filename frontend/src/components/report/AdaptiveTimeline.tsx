import type { Report } from "@/lib/api";
import { moveTone } from "@/lib/sessions";

/** How the interview adapted: each question, how it was asked, and why the engine picked the next move. */
export function AdaptiveTimeline({ steps }: { steps: Report["adaptive"] }) {
  return (
    <ol className="relative flex flex-col gap-5 pl-6">
      <span className="absolute top-2 bottom-2 left-[7px] w-0.5 rounded-full bg-[var(--track)]" aria-hidden />
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.idx} className="relative">
            <span
              className="absolute top-1.5 -left-6 size-4 rounded-full border-[3px] bg-[var(--surface)]"
              style={{ borderColor: moveTone(s.asked_as) }}
              aria-hidden
            />
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--muted)]">Q{s.idx + 1}</span>
              {s.asked_as && <Chip label={s.asked_as} />}
            </div>
            <p className="text-sm">{s.question}</p>
            {!last && s.move_after && (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                → <span style={{ color: moveTone(s.move_after) }}>{s.move_after}</span>
                {s.reason ? ` · ${s.reason}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Chip({ label }: { label: string }) {
  const tone = moveTone(label);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ color: tone, background: `color-mix(in oklab, ${tone} 14%, transparent)` }}
    >
      {label}
    </span>
  );
}
