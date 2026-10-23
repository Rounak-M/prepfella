"use client";

import { useState, type FormEvent } from "react";

import { api, ApiError, type CareerEntry, type CareerInput, type CareerKind } from "@/lib/api";
import { Modal } from "./Modal";
import { MonthPicker } from "./MonthPicker";

const KINDS: { value: CareerKind; label: string }[] = [
  { value: "internship", label: "Internship" },
  { value: "job", label: "Job" },
  { value: "education", label: "Education" },
];

/** Add or edit one career entry. Level "auto" lets the backend guess it from the title. */
export function CareerEntryForm({
  entry,
  levels,
  onClose,
  onSaved,
}: {
  entry: CareerEntry | null;
  levels: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CareerInput>(
    entry
      ? { ...entry }
      : { kind: "internship", title: "", organization: "", start: "", end: null, level: null, salary: null, salary_period: "month", currency: "INR" },
  );
  const [current, setCurrent] = useState(entry ? entry.end === null : false);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // education can end in the future
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CareerInput>(k: K, v: CareerInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.start) {
      setError("Choose a start date");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { ...form, end: current ? null : form.end || null };
    try {
      await api(entry ? `/career/${entry.id}` : "/career", { method: entry ? "PUT" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <Modal title={entry ? "Edit entry" : "Add to your career"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="neu-inset flex gap-1 rounded-2xl p-1">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => set("kind", k.value)}
              className={`flex-1 rounded-xl py-2 text-sm transition ${form.kind === k.value ? "neu font-medium text-[var(--primary)]" : "text-[var(--muted)]"}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">{form.kind === "education" ? "Degree" : "Role"}</span>
            <input className="field" required value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder={form.kind === "education" ? "BCA, Computer Applications" : "Backend Engineering Intern"} />
          </label>
          <label className="sm:col-span-2">
            <span className="label">{form.kind === "education" ? "University" : "Company"}</span>
            <input className="field" value={form.organization} onChange={(e) => set("organization", e.target.value)} />
          </label>
          {/* divs, not labels: a click inside the picker popup must not re-trigger the label's button */}
          <div>
            <span className="label" id="career-start">Start</span>
            <MonthPicker labelId="career-start" value={form.start} onChange={(v) => set("start", v)} max={thisMonth} />
          </div>
          <div>
            <span className="label" id="career-end">End</span>
            <MonthPicker labelId="career-end" value={form.end} onChange={(v) => set("end", v || null)} disabled={current}
              disabledText="Present" align="right" min={form.start || undefined} max={form.kind === "education" ? undefined : thisMonth} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)] sm:col-span-2">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            I&apos;m currently here
          </label>
          <label className="sm:col-span-2">
            <span className="label">Seniority</span>
            <select className="field" value={form.level ?? ""} onChange={(e) => set("level", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">Auto (from the title)</option>
              {Object.entries(levels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {form.kind !== "education" && (
            <>
              <label>
                <span className="label">{form.salary_period === "month" ? "Stipend / salary (₹)" : "CTC (₹ per year)"}</span>
                <input className="field" type="number" min={0} step={500} value={form.salary ?? ""} placeholder="Optional"
                  onChange={(e) => set("salary", e.target.value === "" ? null : Number(e.target.value))} />
              </label>
              <label>
                <span className="label">Paid</span>
                <select className="field" value={form.salary_period} onChange={(e) => set("salary_period", e.target.value as "month" | "year")}>
                  <option value="month">per month</option>
                  <option value="year">per year</option>
                </select>
              </label>
            </>
          )}
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="neu-btn rounded-2xl px-5 py-2.5 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary rounded-2xl px-6 py-2.5 text-sm font-medium">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
