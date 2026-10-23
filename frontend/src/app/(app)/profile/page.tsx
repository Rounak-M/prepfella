"use client";

import { ArrowRight, RotateCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LinkedInIcon } from "@/components/icons";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeCard } from "@/components/profile/ResumeCard";
import { ReviewCard } from "@/components/profile/ReviewCard";
import { api, ApiError, type Profile } from "@/lib/api";

const PROGRESS = ["Reading your resume…", "Matching it against the role…", "Spotting gaps and red flags…", "Planning your interview…"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ message: string; busy: boolean } | null>(null);

  useEffect(() => {
    api<Profile>("/profile").then(setProfile).catch(() => setError({ message: "Could not load your profile", busy: false }));
  }, []);

  // Rotate the progress copy while the review runs (~10 s).
  useEffect(() => {
    if (!reviewing) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 2600);
    return () => clearInterval(id);
  }, [reviewing]);

  async function review() {
    setReviewing(true);
    setStep(0);
    setError(null);
    try {
      setProfile(await api<Profile>("/profile/review", { method: "POST" }));
    } catch (err) {
      const busy = err instanceof ApiError && err.code === "busy";
      setError({ message: busy ? "The AI is busy right now. Give it a few seconds and try again." : err instanceof ApiError ? err.message : "Review failed", busy });
    } finally {
      setReviewing(false);
    }
  }

  if (!profile) {
    return error ? <p className="neu-inset rounded-2xl p-4 text-sm text-[var(--danger)]">{error.message}</p> : <div className="neu h-64 animate-pulse rounded-[28px]" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 md:grid-cols-3">
        <div className="neu rounded-[28px] p-6 md:col-span-2">
          <h1 className="text-2xl font-semibold">Profile &amp; resume</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Set your target, add your resume, and let the AI review it. Your mock interviews then follow the plan it makes.
          </p>
        </div>
        {profile.linkedin_overall != null ? (
          <Link href="/linkedin" className="neu group flex items-center gap-4 rounded-[28px] p-5">
            <span className="btn-primary grid size-12 shrink-0 place-items-center rounded-2xl">
              <LinkedInIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-[var(--muted)]">LinkedIn score</span>
              <span className="block text-2xl font-semibold tabular-nums">{profile.linkedin_overall}<span className="text-sm text-[var(--muted)]">/100</span></span>
            </span>
            <ArrowRight size={18} className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
          </Link>
        ) : (
          <Link href="/linkedin" className="neu group flex items-center gap-4 rounded-[28px] p-5 text-sm">
            <span className="neu-inset grid size-12 shrink-0 place-items-center rounded-2xl text-[var(--primary)]">
              <LinkedInIcon size={20} />
            </span>
            <span className="flex-1 text-[var(--muted)]">Get your LinkedIn profile reviewed too</span>
            <ArrowRight size={18} className="text-[var(--muted)] transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </section>

      <ProfileForm profile={profile} onSaved={setProfile} />
      <ResumeCard profile={profile} onSaved={setProfile} />

      {profile.has_resume && (
        <section className="neu flex flex-wrap items-center gap-4 rounded-[28px] p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{profile.review ? "Changed your resume or target?" : "Ready for your review"}</h2>
            <p className="text-sm text-[var(--muted)]" aria-live="polite">
              {reviewing ? PROGRESS[step] : "Takes about 10 seconds: role fit, strengths, gaps, red flags and an interview plan."}
            </p>
            {error && (
              <p className={`mt-2 text-sm ${error.busy ? "text-[var(--accent-pink)]" : "text-[var(--danger)]"}`}>{error.message}</p>
            )}
          </div>
          <button type="button" onClick={review} disabled={reviewing} className="btn-primary flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium">
            {error?.busy ? <RotateCw size={16} /> : <Sparkles size={16} className={reviewing ? "animate-pulse" : ""} />}
            {reviewing ? "Reviewing…" : error?.busy ? "Try again" : profile.review ? "Review again" : "Review my resume"}
          </button>
        </section>
      )}

      {profile.review && <ReviewCard review={profile.review} reviewedAt={profile.reviewed_at} />}
    </div>
  );
}
