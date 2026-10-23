"use client";

import { ArrowRight, Briefcase, CircleCheck, FileText, GraduationCap, PenLine } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";

import { useUser } from "@/components/AppShell";
import { CareerEntryForm } from "@/components/CareerEntryForm";
import { LinkedInIcon } from "@/components/icons";
import { LinkedInImport } from "@/components/LinkedInImport";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeCard } from "@/components/profile/ResumeCard";
import { api, type CareerResponse, type Profile } from "@/lib/api";
import { byDate, formatRange } from "@/lib/career";

/** First stop after sign-up: set a target, then bring in your background from LinkedIn, a resume, or by hand. */
export default function WelcomePage() {
  const user = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [career, setCareer] = useState<CareerResponse | null>(null);
  const [open, setOpen] = useState<"linkedin" | "resume" | "manual" | null>(null);

  const loadCareer = useCallback(() => api<CareerResponse>("/career").then(setCareer), []);
  useEffect(() => {
    api<Profile>("/profile").then(setProfile);
    loadCareer();
  }, [loadCareer]);

  if (!profile || !career) return <div className="neu h-64 animate-pulse rounded-[28px]" />;

  const entries = [...career.entries].sort(byDate);
  const fromLinkedIn = entries.filter((e) => e.source === "linkedin").length;
  const byHand = entries.length - fromLinkedIn;
  const anything = entries.length > 0 || profile.has_resume || !!profile.target_role;

  return (
    <div className="flex flex-col gap-6">
      <section className="neu rounded-[28px] p-6">
        <p className="text-sm text-[var(--muted)]">Welcome to PrepFella</p>
        <h1 className="mt-1 text-3xl font-semibold">
          Let&apos;s set you up, <span className="text-gradient">{user.name.split(" ")[0]}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Everything PrepFella coaches you on comes from what you add here: interview questions, Fella&apos;s answers and your
          learning roadmap. Add as much as you like; you can change all of it later.
        </p>
      </section>

      <ProfileForm profile={profile} onSaved={setProfile} />

      <section className="neu flex flex-col gap-4 rounded-[28px] p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Your background</h2>
          <p className="text-sm text-[var(--muted)]">Pick one or more. LinkedIn and manual entries build your career graph; the resume drives your interviews.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Option icon={LinkedInIcon} title="Import from LinkedIn" text="Paste your profile link or upload its PDF export."
            done={fromLinkedIn ? `${fromLinkedIn} ${fromLinkedIn === 1 ? "entry" : "entries"} imported` : null} onClick={() => setOpen("linkedin")} />
          <Option icon={FileText} title="Upload your resume" text="A PDF or pasted text, for questions about your projects."
            done={profile.has_resume ? "Resume added" : null} active={open === "resume"} onClick={() => setOpen(open === "resume" ? null : "resume")} />
          <Option icon={PenLine} title="Add it yourself" text="Jobs, internships and education, one at a time."
            done={byHand ? `${byHand} ${byHand === 1 ? "entry" : "entries"} added` : null} onClick={() => setOpen("manual")} />
        </div>

        {open === "resume" && <ResumeCard profile={profile} onSaved={setProfile} />}

        {entries.length > 0 && (
          <ul className="neu-inset flex flex-col gap-1 rounded-2xl p-2">
            {entries.map((e) => {
              const Icon = e.kind === "education" ? GraduationCap : Briefcase;
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                  <Icon size={16} className="shrink-0 text-[var(--primary)]" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{e.title}</span>
                    {e.organization && <span className="text-[var(--muted)]"> · {e.organization}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted)] tabular-nums">{formatRange(e)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Link href="/dashboard" className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium ${anything ? "btn-primary" : "neu-btn"}`}>
          {anything ? "Go to my dashboard" : "Skip for now"} <ArrowRight size={16} />
        </Link>
      </div>

      {open === "linkedin" && (
        <LinkedInImport
          onClose={() => setOpen(null)}
          onImported={() => {
            setOpen(null);
            loadCareer();
            api<Profile>("/profile").then(setProfile); // the import saves the LinkedIn link on the profile
          }}
        />
      )}
      {open === "manual" && (
        <CareerEntryForm
          entry={null}
          levels={career.levels}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            loadCareer();
          }}
        />
      )}
    </div>
  );
}

function Option({ icon: Icon, title, text, done, active, onClick }: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  text: string;
  done: string | null;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-expanded={active}
      className={`group flex flex-col gap-3 rounded-3xl p-5 text-left transition hover:-translate-y-0.5 ${active ? "neu-inset" : "neu-btn"}`}>
      <span className="btn-primary grid size-11 place-items-center rounded-2xl">
        <Icon size={19} />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{text}</span>
      </span>
      {done && (
        <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
          <CircleCheck size={14} /> {done}
        </span>
      )}
    </button>
  );
}
