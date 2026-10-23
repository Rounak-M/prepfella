import { ChevronRight, Mic, Type } from "lucide-react";
import Link from "next/link";

import type { SessionSummary } from "@/lib/api";
import { formatDate, scoreTone, TYPE_LABELS } from "@/lib/sessions";

/** Interviews, newest first (the latest `limit`, or all); finished ones open the report, unfinished ones resume the interview. */
export function RecentInterviews({ sessions, limit = 5 }: { sessions: SessionSummary[]; limit?: number }) {
  if (!sessions.length) {
    return <p className="neu-inset rounded-2xl p-4 text-sm text-[var(--muted)]">No interviews yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {sessions.slice(0, limit).map((s) => {
        const finished = s.status === "finished";
        return (
          <li key={s.id}>
            <Link
              href={finished ? `/report/${s.id}` : `/interview/${s.id}`}
              className="neu-inset group flex items-center gap-4 rounded-2xl p-3 pr-4 transition hover:text-[var(--primary)]"
            >
              <span className="neu grid size-11 shrink-0 place-items-center rounded-xl text-[var(--primary)]">
                {s.mode === "voice" ? <Mic size={18} /> : <Type size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.role}</div>
                <div className="truncate text-sm text-[var(--muted)]">
                  {TYPE_LABELS[s.interview_type]} · {s.difficulty} · {formatDate(s.started_at, { day: "numeric", month: "short" })}
                </div>
              </div>
              {finished && s.overall != null ? (
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold tabular-nums"
                  style={{ color: scoreTone(s.overall / 10), background: `color-mix(in oklab, ${scoreTone(s.overall / 10)} 14%, transparent)` }}
                >
                  {s.overall}
                </span>
              ) : (
                <span className="rounded-full px-3 py-1 text-xs text-[var(--accent-cyan)]">In progress</span>
              )}
              <ChevronRight size={16} className="text-[var(--muted)] transition group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
