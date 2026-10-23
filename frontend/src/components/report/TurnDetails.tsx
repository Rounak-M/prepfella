import { ChevronDown } from "lucide-react";

import { DIMENSIONS, DIMENSION_LABELS, type Turn } from "@/lib/api";
import { scoreTone } from "@/lib/sessions";
import { Chip } from "./AdaptiveTimeline";

/** One answered question as a collapsible card: answer, scores with quoted evidence, feedback, speaking metrics. */
export function TurnDetails({ turn, open }: { turn: Turn; open?: boolean }) {
  const avg = turn.scores ? DIMENSIONS.reduce((s, d) => s + turn.scores![d], 0) / DIMENSIONS.length : null;
  return (
    <details open={open} className="neu-inset group rounded-2xl p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="mt-0.5 text-xs text-[var(--muted)]">Q{turn.idx + 1}</span>
        <div className="min-w-0 flex-1">
          {turn.label && (
            <div className="mb-1">
              <Chip label={turn.label} />
            </div>
          )}
          <p className="text-sm font-medium">{turn.question}</p>
        </div>
        {avg != null && (
          <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: scoreTone(avg) }}>
            {avg.toFixed(1)}
          </span>
        )}
        <ChevronDown size={16} className="mt-0.5 shrink-0 text-[var(--muted)] transition group-open:rotate-180" />
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <span className="label">Your answer</span>
          <p className="text-sm whitespace-pre-line text-[var(--muted)]">{turn.answer_text || "(no answer)"}</p>
        </div>

        {turn.scores && (
          <div className="grid gap-3 sm:grid-cols-2">
            {DIMENSIONS.map((d) => (
              <div key={d} className="neu rounded-2xl p-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{DIMENSION_LABELS[d]}</span>
                  <span className="font-semibold tabular-nums" style={{ color: scoreTone(turn.scores![d]) }}>
                    {turn.scores![d]}/10
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">{turn.evidence?.[d]}</p>
              </div>
            ))}
          </div>
        )}

        {turn.feedback && (
          <p className="text-sm">
            <b className="text-[var(--primary)]">Fix:</b> {turn.feedback}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          {turn.wpm != null && <Metric label="Pace" value={`${turn.wpm} wpm`} />}
          {turn.filler_count != null && <Metric label="Fillers" value={String(turn.filler_count)} />}
          {turn.answer_seconds != null && <Metric label="Time" value={`${Math.round(turn.answer_seconds)} s`} />}
        </div>
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="neu rounded-full px-3 py-1">
      {label}: <b className="text-[var(--fg)]">{value}</b>
    </span>
  );
}
