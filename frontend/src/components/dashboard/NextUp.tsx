"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, type SessionDetail } from "@/lib/api";
import { nextSessionHref, TYPE_LABELS } from "@/lib/sessions";

/** Recommended next session + study plan, taken from the latest finished interview's report. */
export function NextUp({ sessionId }: { sessionId: number | null }) {
  const [session, setSession] = useState<SessionDetail | null>(null);

  useEffect(() => {
    if (sessionId == null) return;
    api<SessionDetail>(`/sessions/${sessionId}`).then(setSession).catch(() => {});
  }, [sessionId]);

  if (sessionId == null) {
    return (
      <div className="flex flex-col gap-4 text-sm text-[var(--muted)]">
        <p>Do a mock interview and we&apos;ll plan your next practice session and study tasks from the results.</p>
        <Link href="/setup" className="btn-primary inline-flex w-fit items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium">
          Start an interview <ArrowRight size={16} />
        </Link>
      </div>
    );
  }
  const report = session?.id === sessionId ? session.report : null;
  if (!report) return <div className="neu-inset h-48 animate-pulse rounded-2xl" />;

  const next = report.next_session;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-[var(--muted)]">
          {next.count} questions · {next.difficulty} · {TYPE_LABELS[next.type ?? session!.interview_type]}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {next.topics.map((t) => (
            <span key={t} className="neu-inset rounded-full px-3 py-1.5 text-xs text-[var(--accent-cyan)]">{t}</span>
          ))}
        </div>
      </div>
      {report.study_plan.length > 0 && (
        <ul className="flex flex-col gap-2">
          {report.study_plan.slice(0, 3).map((p, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <BookOpen size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <span>
                {p.task}
                <span className="block text-xs text-[var(--muted)]">{p.why}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={nextSessionHref(next, session!.interview_type)}
        className="btn-primary mt-auto inline-flex w-fit items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium"
      >
        Start recommended session <ArrowRight size={16} />
      </Link>
    </div>
  );
}
