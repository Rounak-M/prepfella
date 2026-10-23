"use client";

import { Check, CircleCheck, CircleX, Copy, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { LinkedInSource } from "@/components/LinkedInSource";
import { ScoreRing } from "@/components/ScoreRing";
import { api, ApiError, linkedinForm, type LinkedInReview } from "@/lib/api";

const SECTION_LABELS = { headline: "Headline", about: "About", experience: "Experience", education: "Education", skills: "Skills" } as const;

export default function LinkedInPage() {
  const [review, setReview] = useState<LinkedInReview | null>(null);
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [needPdf, setNeedPdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<LinkedInReview | null>("/profile/linkedin").then(setReview).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setReview(await api<LinkedInReview>("/profile/linkedin", { method: "POST", body: linkedinForm(url, pdf) }));
      setNeedPdf(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "linkedin_unavailable") setNeedPdf(err.message);
      else setError(err instanceof ApiError ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="neu rounded-[28px] p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">LinkedIn profile review</h1>
        <p className="mt-1 mb-5 text-sm text-[var(--muted)]">Paste your profile link. The AI rates each section and suggests concrete rewrites.</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <LinkedInSource url={url} pdf={pdf} onUrl={setUrl} onPdf={setPdf} needPdf={needPdf} />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div>
            <button type="submit" disabled={busy || (!url.trim() && !pdf)} className="btn-primary flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium">
              <Sparkles size={16} /> {busy ? "Reviewing… (about 15 s)" : review ? "Review again" : "Review my profile"}
            </button>
          </div>
        </form>
      </section>

      {review && <ReviewResult review={review} />}
    </div>
  );
}

function ReviewResult({ review }: { review: LinkedInReview }) {
  const sections = Object.entries(review.sections) as [keyof typeof SECTION_LABELS, LinkedInReview["sections"]["about"]][];
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="neu flex flex-col items-center gap-4 rounded-[28px] p-6">
          <h2 className="font-semibold">Profile score</h2>
          <ScoreRing value={review.overall ?? 0} label="out of 100" />
          <p className="max-w-52 text-center text-xs text-[var(--muted)]">
            {review.source === "pdf" ? "Based on your full PDF export" : "Based on your public profile. Upload the PDF to include skills."}
          </p>
        </div>
        <div className="neu rounded-[28px] p-6">
          <h2 className="mb-4 font-semibold">Section scores</h2>
          <div className="flex flex-col gap-4">
            {sections.map(([name, s]) => (
              <div key={name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{SECTION_LABELS[name]}</span>
                  <span className="tabular-nums text-[var(--muted)]">{s ? `${s.score}/10` : "not visible"}</span>
                </div>
                <div className="neu-inset h-3 rounded-full p-0.5">
                  <div className="h-full rounded-full bg-[image:var(--primary-gradient)] transition-[width] duration-700" style={{ width: `${(s?.score ?? 0) * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Top fixes">
          <ol className="flex flex-col gap-3">
            {review.top_fixes.map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--primary-gradient)] text-xs font-semibold text-white">{i + 1}</span>
                {f}
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Quick checks">
          <ul className="flex flex-col gap-3">
            {review.checks.map((c) => (
              <li key={c.label} className="flex gap-3 text-sm">
                {c.ok ? <CircleCheck size={18} className="shrink-0 text-[var(--success)]" /> : <CircleX size={18} className="shrink-0 text-[var(--danger)]" />}
                <span>
                  {c.label}
                  {!c.ok && <span className="block text-xs text-[var(--muted)]">{c.tip}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card title="Headline ideas">
        <div className="flex flex-col gap-3">
          {review.headline_options.map((h) => (
            <CopyRow key={h} text={h} />
          ))}
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        {sections.filter(([, s]) => s).map(([name, s]) => (
          <Card key={name} title={`${SECTION_LABELS[name]} · ${s!.score}/10`}>
            <p className="text-sm text-[var(--muted)]">{s!.comment}</p>
            <p className="mt-3 text-sm"><b className="text-[var(--primary)]">Try:</b> {s!.suggestion}</p>
          </Card>
        ))}
      </section>

      {review.about_rewrite && (
        <Card title="Suggested About section">
          <CopyRow text={review.about_rewrite} multiline />
          <p className="mt-2 text-xs text-[var(--muted)]">Replace the [bracketed] parts with your own details.</p>
        </Card>
      )}

      {review.missing_keywords.length > 0 && (
        <Card title="Keywords recruiters search for that you're missing">
          <div className="flex flex-wrap gap-2">
            {review.missing_keywords.map((k) => (
              <span key={k} className="neu-inset rounded-full px-3 py-1.5 text-xs text-[var(--accent-cyan)]">{k}</span>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="neu rounded-[28px] p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CopyRow({ text, multiline }: { text: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="neu-inset flex items-start gap-3 rounded-2xl p-3">
      <p className={`flex-1 text-sm ${multiline ? "whitespace-pre-line" : ""}`}>{text}</p>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="neu-btn grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)]"
      >
        {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
