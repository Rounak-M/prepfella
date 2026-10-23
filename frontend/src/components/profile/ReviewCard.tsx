import { ArrowRight, CircleCheck, ShieldCheck, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ProfileReview } from "@/lib/api";

const FIT = {
  strong: { label: "Strong fit", color: "var(--success)" },
  good: { label: "Good fit", color: "var(--accent-cyan)" },
  developing: { label: "Developing", color: "var(--accent-pink)" },
} as const;

/** AI Profile Review (§4.1): role fit, strengths, gaps, red flags, claims to verify, interview plan. */
export function ReviewCard({ review, reviewedAt }: { review: ProfileReview; reviewedAt: string | null }) {
  const fit = FIT[review.role_fit.level] ?? FIT.good;
  return (
    <div className="flex flex-col gap-6">
      <section className="neu rounded-[28px] p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">AI profile review</h2>
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-[#1b1840]" style={{ background: fit.color }}>
            {fit.label}
          </span>
          {reviewedAt && <span className="ml-auto text-xs text-[var(--muted)]">Reviewed {new Date(reviewedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
        </div>
        <p className="text-sm text-[var(--muted)]">{review.role_fit.summary}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Strengths" icon={<CircleCheck size={18} className="text-[var(--success)]" />} items={review.strengths} />
        <ListCard title="Gaps to work on" icon={<Target size={18} className="text-[var(--accent-pink)]" />} items={review.gaps} />
      </section>

      {review.red_flags.length > 0 && (
        <Card title="Red flags in your resume" icon={<TriangleAlert size={18} className="text-[var(--danger)]" />}>
          <ul className="flex flex-col gap-3">
            {review.red_flags.map((f) => (
              <li key={f.issue} className="neu-inset rounded-2xl p-4 text-sm">
                <div className="font-medium">{f.issue}</div>
                <div className="mt-1 text-[var(--muted)]">
                  <b className="text-[var(--primary)]">Fix:</b> {f.fix}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {review.resume_claims.length > 0 && (
          <Card title="The interviewer will verify these" icon={<ShieldCheck size={18} className="text-[var(--accent-cyan)]" />}>
            <ul className="flex flex-col gap-2">
              {review.resume_claims.map((c) => (
                <li key={c} className="neu-inset rounded-2xl px-4 py-3 text-sm">“{c}”</li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Your interview plan">
          <div className="flex flex-wrap gap-2">
            {review.interview_plan.map((t) => (
              <span key={t.topic} className="neu-inset flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                <span className="size-2 rounded-full" style={{ background: t.kind === "hr" ? "var(--accent-pink)" : "var(--accent-cyan)" }} />
                {t.topic}
                {t.count > 1 && <span className="text-[var(--muted)]">×{t.count}</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--accent-cyan)]" /> Technical</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--accent-pink)]" /> HR / behavioural</span>
          </p>
          <Link href="/setup" className="btn-primary mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium">
            Start a mock interview with this plan <ArrowRight size={16} />
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="neu rounded-[28px] p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function ListCard({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return (
    <Card title={title} icon={icon}>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            {s}
          </li>
        ))}
      </ul>
    </Card>
  );
}
