"use client";

import { FileText, History, Keyboard, Mic, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
import { ThinkingIndicator } from "@/components/interview/ThinkingIndicator";
import { api, ApiError, type InterviewType, type Profile, type SessionCreate, type SessionDetail, type SessionSummary } from "@/lib/api";

const ROLE_SUGGESTIONS = ["Backend Engineer", "Frontend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist",
  "Cybersecurity Specialist", "DevOps Engineer", "Product Manager"];
const LEVELS = ["Intern", "Fresher", "Junior", "Mid", "Senior"];
const TYPES: { value: InterviewType; label: string; hint: string }[] = [
  { value: "technical", label: "Technical", hint: "Concepts, design, debugging" },
  { value: "hr", label: "HR", hint: "Behavioural, STAR stories" },
  { value: "mixed", label: "Mixed", hint: "A bit of both" },
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const PREPARING = ["Reading your profile…", "Planning topics…", "Preparing your first question…"];

export default function SetupPage() {
  return (
    // useSearchParams (prefill from a report's next session) needs a Suspense boundary in Next 16.
    <Suspense fallback={<div className="neu h-96 animate-pulse rounded-[28px]" />}>
      <SetupWizard />
    </Suspense>
  );
}

function SetupWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [form, setForm] = useState<SessionCreate>(() => ({
    role: "",
    level: "Fresher",
    interview_type: (["technical", "hr", "mixed"].includes(params.get("type") ?? "") ? params.get("type") : "technical") as InterviewType,
    difficulty: (DIFFICULTIES as readonly string[]).includes(params.get("difficulty") ?? "") ? (params.get("difficulty") as SessionCreate["difficulty"]) : "medium",
    mode: "voice",
    question_count: Math.min(8, Math.max(3, Number(params.get("count")) || 4)),
    topics: params.get("topics")?.split("|").filter(Boolean),
  }));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>("/profile")
      .then((p) => {
        setProfile(p);
        setForm((f) => ({
          ...f,
          role: f.role || p.target_role,
          level: LEVELS.includes(p.experience_level) ? p.experience_level : f.level,
        }));
      })
      .catch(() => {});
    api<SessionSummary[]>("/sessions").then(setSessions).catch(() => setSessions([]));
  }, []);

  const set = <K extends keyof SessionCreate>(k: K, v: SessionCreate[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function start(e: FormEvent) {
    e.preventDefault();
    if (form.role.trim().length < 2) {
      setError("Type the role you're practising for, e.g. Backend Engineer.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const s = await api<SessionDetail>("/sessions", { method: "POST", body: JSON.stringify({ ...form, role: form.role.trim() }) });
      router.push(`/interview/${s.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the interview. Try again.");
      setStarting(false);
    }
  }

  if (starting) {
    return (
      <div className="neu grid min-h-96 place-items-center rounded-[28px] p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Setting up your interview</h1>
          <ThinkingIndicator steps={PREPARING} />
        </div>
      </div>
    );
  }

  const review = profile?.review;
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
      <form onSubmit={start} className="flex min-w-0 flex-col gap-6">
        <section className="neu rounded-[28px] p-5 sm:p-6">
          <h1 className="text-2xl font-semibold">Mock interview</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Pick the interview you want to practise. Questions adapt to every answer you give.</p>
  
          {profile && (
            <div className="neu-inset mt-5 flex items-start gap-3 rounded-2xl p-4 text-sm">
              <FileText size={18} className="mt-0.5 shrink-0 text-[var(--primary)]" />
              {review ? (
                <p>
                  Questions will use your resume review: <b>{review.resume_claims.length} claims</b> to verify
                  {review.interview_plan.length > 0 && <> and planned topics <b>{review.interview_plan.map((t) => t.topic).join(", ")}</b></>}.
                </p>
              ) : (
                <p>
                  <Link href="/profile" className="font-medium text-[var(--primary)] underline">Upload your resume</Link> to get questions about your own
                  projects, including ones that check your resume claims.
                </p>
              )}
            </div>
          )}
        </section>
  
        <section className="neu grid gap-6 rounded-[28px] p-5 sm:p-6 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="label">Role</span>
            <input className="field" required minLength={2} list="role-suggestions" value={form.role} placeholder="Type a role, e.g. Backend Engineer"
              onInvalid={(e) => e.currentTarget.setCustomValidity(form.role.trim() ? "" : "Type the role you're practising for")}
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              onChange={(e) => set("role", e.target.value)} />
            <datalist id="role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </label>
  
          <Field label="Experience level" className="md:col-span-2">
            <Segmented options={LEVELS.map((l) => ({ value: l, label: l }))} value={form.level} onChange={(v) => set("level", v)} />
          </Field>
  
          <Field label="Interview type" className="md:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              {TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => set("interview_type", t.value)} aria-pressed={form.interview_type === t.value}
                  className={`rounded-2xl p-4 text-left transition ${form.interview_type === t.value ? "neu-inset" : "neu-btn"}`}>
                  <span className={`block font-medium ${form.interview_type === t.value ? "text-[var(--primary)]" : ""}`}>{t.label}</span>
                  <span className="block text-xs text-[var(--muted)]">{t.hint}</span>
                </button>
              ))}
            </div>
          </Field>
  
          <Field label="Difficulty">
            <Segmented options={DIFFICULTIES.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} value={form.difficulty}
              onChange={(v) => set("difficulty", v)} />
          </Field>
  
          <Field label="Answer by">
            <Segmented
              options={[
                { value: "voice", label: <span className="flex items-center justify-center gap-2"><Mic size={15} /> Voice</span> },
                { value: "text", label: <span className="flex items-center justify-center gap-2"><Keyboard size={15} /> Text</span> },
              ]}
              value={form.mode}
              onChange={(v) => set("mode", v)}
            />
          </Field>
  
          <Field label={`Questions: ${form.question_count}`} className="md:col-span-2">
            <input type="range" min={3} max={8} value={form.question_count} onChange={(e) => set("question_count", Number(e.target.value))}
              className="w-full accent-[var(--primary)]" aria-label="Number of questions" />
            <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
              <span>3 · quick</span>
              <span>about {form.question_count * 2} min</span>
              <span>8 · full</span>
            </div>
          </Field>
  
          {form.topics && form.topics.length > 0 && (
            <Field label="Focus topics (from your last report)" className="md:col-span-2">
              <div className="flex flex-wrap gap-2">
                {form.topics.map((t) => (
                  <span key={t} className="neu-inset flex items-center gap-1.5 rounded-full py-1.5 pr-2 pl-3 text-xs text-[var(--accent-cyan)]">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => set("topics", form.topics!.filter((x) => x !== t))}
                      className="rounded-full p-0.5 text-[var(--muted)] hover:text-[var(--danger)]">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </Field>
          )}
        </section>
  
        {error && <p className="neu-inset rounded-2xl px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {form.mode === "voice" && <p className="text-xs text-[var(--muted)]">Your browser will ask for the microphone when you answer.</p>}
          {/* Never disabled: an empty role (new accounts have no target yet) gets the browser's "fill this in" prompt on the field instead of a dead button */}
          <button type="submit" className="btn-primary flex items-center gap-2 rounded-2xl px-7 py-3 font-medium">
            <Sparkles size={16} /> Start interview
          </button>
        </div>
      </form>

      {/* Every past interview, so earlier reports are one click away while setting up the next one */}
      <section className="neu flex flex-col rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
        <div className="mb-4 flex items-center gap-3">
          <History size={18} className="text-[var(--primary)]" />
          <h2 className="text-lg font-semibold">Past interviews</h2>
          {!!sessions?.length && <span className="ml-auto text-sm text-[var(--muted)] tabular-nums">{sessions.length}</span>}
        </div>
        <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1">
          {sessions ? <RecentInterviews sessions={sessions} limit={Infinity} /> : <div className="neu-inset h-24 animate-pulse rounded-2xl" />}
        </div>
      </section>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="neu-inset flex gap-1 rounded-2xl p-1" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-2 text-sm transition ${value === o.value ? "neu font-medium text-[var(--primary)]" : "text-[var(--muted)]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
