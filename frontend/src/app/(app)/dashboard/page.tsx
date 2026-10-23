"use client";

import { Briefcase, GraduationCap, Pencil, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useUser } from "@/components/AppShell";
import { CareerEntryForm } from "@/components/CareerEntryForm";
import { CareerGraph } from "@/components/CareerGraph";
import { NextUp } from "@/components/dashboard/NextUp";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { LinkedInIcon } from "@/components/icons";
import { LinkedInImport } from "@/components/LinkedInImport";
import { api, type CareerEntry, type CareerResponse, type SessionSummary } from "@/lib/api";
import { byDate, formatRange, formatSalary } from "@/lib/career";

export default function DashboardPage() {
  const user = useUser();
  const [data, setData] = useState<CareerResponse | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [editing, setEditing] = useState<CareerEntry | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => api<CareerResponse>("/career").then(setData), []);
  useEffect(() => {
    load();
    api<SessionSummary[]>("/sessions").then(setSessions).catch(() => setSessions([]));
  }, [load]);

  // Sessions come newest first.
  const finished = (sessions ?? []).filter((s) => s.status === "finished" && s.overall != null);
  const latestScore = finished[0]?.overall ?? null;
  const scoreDelta = finished.length > 1 ? latestScore! - finished[1].overall! : null;

  async function remove(e: CareerEntry) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    await api(`/career/${e.id}`, { method: "DELETE" });
    load();
  }

  const entries = data?.entries ?? [];
  const roles = entries.filter((e) => e.kind !== "education");
  const latestPay = [...roles].reverse().find((e) => e.salary_yearly != null);
  const firstPay = roles.find((e) => e.salary_yearly != null);
  const growth =
    latestPay && firstPay && firstPay !== latestPay
      ? Math.round(((latestPay.salary_yearly! - firstPay.salary_yearly!) / firstPay.salary_yearly!) * 100)
      : null;
  const hour = new Date().getHours();

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + graph rows fill the sidebar's height on desktop, so the graph tiles end level with the menu tile */}
      <div className="flex flex-col gap-6 lg:min-h-[calc(100dvh-3rem)]">
        <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="neu relative overflow-hidden rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">{hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}</p>
            <h1 className="mt-1 text-3xl font-semibold">
              Hi, <span className="text-gradient">{user.name.split(" ")[0]}</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{user.tagline}. Track how your career is moving and get ready for the next step.</p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-1">
            <Stat
              icon={<Target size={18} />}
              label={finished.length ? `Interview score · ${finished.length} done` : "Interview score"}
              value={latestScore != null ? String(latestScore) : "—"}
              delta={scoreDelta}
              tone="var(--primary-gradient)"
            />
            <Stat
              icon={<TrendingUp size={18} />}
              label={growth != null ? "Pay growth" : "Latest pay"}
              value={growth != null ? `${growth > 0 ? "+" : ""}${growth}%` : latestPay ? formatSalary(latestPay)! : "—"}
              tone="linear-gradient(135deg, #2fd6f0, #0a8fb0)"
            />
          </div>
        </section>

        {/* Big tile: career graph · square tile: interview progress */}
        <section className="grid gap-6 lg:flex-1 lg:grid-cols-[2fr_1fr]">
          <div className="neu flex flex-col rounded-[28px] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold">Career graph</h2>
                <p className="text-sm text-[var(--muted)]">Seniority and salary over time</p>
              </div>
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={() => setImporting(true)} className="neu-btn flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm">
                  <LinkedInIcon size={16} /> Import
                </button>
                <button type="button" onClick={() => setEditing("new")} className="btn-primary flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium">
                  <Plus size={16} /> Add role
                </button>
              </div>
            </div>
            {notice && <p className="neu-inset mb-4 rounded-2xl px-4 py-3 text-sm text-[var(--success)]">{notice}</p>}
            <div className="flex min-h-0 flex-1 flex-col">
              {data ? <CareerGraph entries={entries} levels={data.levels} /> : <div className="neu-inset min-h-72 flex-1 animate-pulse rounded-3xl" />}
            </div>
          </div>
          <div className="neu flex flex-col rounded-[28px] p-5 sm:p-6">
            <div className="mb-2 flex items-start gap-3">
              <div>
                <h2 className="text-lg font-semibold">Interview progress</h2>
                <p className="text-sm text-[var(--muted)]">Score per interview</p>
              </div>
              <Link href="/setup" aria-label="New interview" title="New interview" className="neu-btn ml-auto grid size-10 shrink-0 place-items-center rounded-full">
                <Plus size={18} />
              </Link>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <ProgressChart />
            </div>
          </div>
        </section>
      </div>

      {/* Timeline beside Next up (past interviews live on the Mock interview tab) */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        {entries.length > 0 && (
          <section className="neu min-w-0 rounded-[28px] p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
            <ul className="flex flex-col gap-3">
              {[...entries].sort(byDate).map((e) => (
                <li key={e.id} className="neu-inset flex items-center gap-4 rounded-2xl p-3 pr-4">
                  <span className="neu grid size-11 shrink-0 place-items-center rounded-xl text-[var(--primary)]">
                    {e.kind === "education" ? <GraduationCap size={18} /> : <Briefcase size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="truncate text-sm text-[var(--muted)]">
                      {[e.organization, formatRange(e)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <div className="text-[var(--primary)]">{e.level_label}</div>
                    <div className="text-[var(--accent-pink)]">{formatSalary(e) ?? ""}</div>
                  </div>
                  {e.source === "linkedin" && (
                    <span title="Imported from LinkedIn" className="text-[var(--muted)]">
                      <LinkedInIcon size={14} />
                    </span>
                  )}
                  <button type="button" onClick={() => setEditing(e)} aria-label={`Edit ${e.title}`} className="neu-btn grid size-9 place-items-center rounded-full text-[var(--muted)]">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => remove(e)} aria-label={`Delete ${e.title}`} className="neu-btn grid size-9 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--danger)]">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="neu flex flex-col rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Next up</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">Planned from your last report</p>
          {sessions ? <NextUp sessionId={finished[0]?.id ?? null} /> : <div className="neu-inset h-48 animate-pulse rounded-2xl" />}
        </div>
      </section>

      {editing && data && (
        <CareerEntryForm
          entry={editing === "new" ? null : editing}
          levels={data.levels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {importing && (
        <LinkedInImport
          onClose={() => setImporting(false)}
          onImported={(n) => {
            setImporting(false);
            setNotice(n ? `Imported ${n} ${n === 1 ? "entry" : "entries"} from LinkedIn. Add salaries to see the pay line.` : "Everything from LinkedIn was already here.");
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone, delta }: { icon: ReactNode; label: string; value: string; tone: string; delta?: number | null }) {
  return (
    <div className="neu flex items-center gap-4 rounded-[28px] p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: tone }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs text-[var(--muted)]">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {delta != null && delta !== 0 && (
            <span className={`text-sm font-medium tabular-nums ${delta > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
