"use client";

import { ArrowRight, CircleAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AdaptiveTimeline } from "@/components/report/AdaptiveTimeline";
import { ScoreBars } from "@/components/report/ScoreBars";
import { TurnDetails } from "@/components/report/TurnDetails";
import { ScoreRing } from "@/components/ScoreRing";
import { api, ApiError, DIMENSION_LABELS, type SessionDetail } from "@/lib/api";
import { formatDate, nextSessionHref, TYPE_LABELS } from "@/lib/sessions";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionDetail>(`/sessions/${id}`)
      .then(setSession)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load this report"));
  }, [id]);

  if (error) return <p className="neu rounded-[28px] p-6 text-sm text-[var(--danger)]">{error}</p>;
  if (!session) return <div className="neu h-64 animate-pulse rounded-[28px]" />;

  const report = session.report;
  if (session.status !== "finished" || !report) {
    return (
      <div className="neu flex flex-col items-start gap-4 rounded-[28px] p-6">
        <h1 className="text-xl font-semibold">This interview isn&apos;t finished yet</h1>
        <p className="text-sm text-[var(--muted)]">Finish it to get your scores, fixes and a stronger model answer.</p>
        <Link href={`/interview/${session.id}`} className="btn-primary flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium">
          Continue interview <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  const answered = session.turns.filter((t) => t.answered);
  const steps = report.adaptive?.length
    ? report.adaptive
    : answered.map((t) => ({ idx: t.idx, question: t.question, asked_as: t.label, move_after: t.decision?.label ?? null, reason: t.decision?.reason ?? null }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="neu flex flex-col items-center gap-3 rounded-[28px] p-6">
          <h2 className="font-semibold">Overall</h2>
          <ScoreRing value={report.overall} label="out of 100" />
          <p className="text-xs text-[var(--muted)]">
            Weakest: <span className="text-[var(--accent-pink)]">{DIMENSION_LABELS[report.weakest]}</span>
          </p>
        </div>
        <div className="neu flex flex-col rounded-[28px] p-6">
          <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
            {[session.level, TYPE_LABELS[session.interview_type], `${session.difficulty} difficulty`, session.mode === "voice" ? "Voice" : "Text", formatDate(session.ended_at)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{session.role} interview report</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{report.summary}</p>
          {!report.ai && (
            <p className="mt-3 flex items-center gap-2 text-xs text-[var(--accent-pink)]">
              <CircleAlert size={14} /> The AI coach was busy, so this is a basic report built from your per-answer scores.
            </p>
          )}
          <div className="mt-4 flex-1">
            <ScoreBars averages={report.averages} weakest={report.weakest} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Top fixes">
          <ol className="flex flex-col gap-3">
            {report.top_fixes.map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--primary-gradient)] text-xs font-semibold text-white">{i + 1}</span>
                {f}
              </li>
            ))}
          </ol>
        </Card>
        <Card title="What went well">
          {report.strengths.length ? (
            <ul className="flex flex-col gap-3">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--success)]" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nothing stood out yet. Keep practising.</p>
          )}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card title="How the interview adapted" subtitle="After every answer the engine picked the next move from your scores.">
          <AdaptiveTimeline steps={steps} />
        </Card>
        <Card title="Question by question">
          <div className="flex flex-col gap-3">
            {answered.map((t, i) => (
              <TurnDetails key={t.idx} turn={t} open={i === 0} />
            ))}
          </div>
        </Card>
      </section>

      {report.model_answers.length > 0 && (
        <Card title="A stronger answer">
          <div className="flex flex-col gap-4">
            {report.model_answers.map((m, i) => (
              <div key={i}>
                <p className="mb-2 text-sm font-medium">{m.question}</p>
                <p className="neu-inset rounded-2xl p-4 text-sm whitespace-pre-line">{m.stronger_answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">Replace any [bracketed] parts with your own details.</p>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {report.study_plan.length > 0 && (
          <Card title="Study plan for this week">
            <ul className="flex flex-col gap-3">
              {report.study_plan.map((p, i) => (
                <li key={i} className="neu-inset rounded-2xl p-3 text-sm">
                  <div className="font-medium">{p.task}</div>
                  <div className="text-xs text-[var(--muted)]">{p.why}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Your next session">
          <p className="text-sm text-[var(--muted)]">
            {report.next_session.count} questions · {report.next_session.difficulty} · {TYPE_LABELS[report.next_session.type ?? session.interview_type]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.next_session.topics.map((t) => (
              <span key={t} className="neu-inset rounded-full px-3 py-1.5 text-xs text-[var(--accent-cyan)]">{t}</span>
            ))}
          </div>
          <Link
            href={nextSessionHref(report.next_session, session.interview_type)}
            className="btn-primary mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium"
          >
            Start this session <ArrowRight size={16} />
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="neu rounded-[28px] p-6">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
