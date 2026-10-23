"use client";

import { Check, Globe, Link2, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { LinkedInIcon } from "@/components/icons";
import { api, ApiError, type Profile } from "@/lib/api";

const LEVELS = ["Intern", "Fresher", "Junior", "Mid", "Senior"];
const LINKS = [
  { key: "github", label: "GitHub", placeholder: "https://github.com/your-name", icon: Link2 },
  { key: "portfolio", label: "Portfolio", placeholder: "https://your-site.dev", icon: Globe },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/your-name", icon: LinkedInIcon },
];

/** Target role, experience level and links (PUT /profile). */
export function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [role, setRole] = useState(profile.target_role);
  const [level, setLevel] = useState(profile.experience_level);
  const [links, setLinks] = useState<Record<string, string>>(profile.links ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(links).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
      onSaved(await api<Profile>("/profile", { method: "PUT", body: JSON.stringify({ target_role: role.trim(), experience_level: level, links: clean }) }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="neu flex flex-col gap-4 rounded-[28px] p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Your target</h2>
        <p className="text-sm text-[var(--muted)]">The review and your interviews are tuned to this role and level.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Target role</span>
          <input className="field" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend Engineer" maxLength={100} />
        </label>
        <div>
          <span className="label">Experience level</span>
          <div className="neu-inset flex flex-wrap gap-1 rounded-2xl p-1" role="radiogroup" aria-label="Experience level">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={`flex-1 rounded-xl px-2 py-2 text-sm transition ${level === l ? "neu font-medium text-[var(--primary)]" : "text-[var(--muted)]"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {LINKS.map(({ key, label, placeholder, icon: Icon }) => (
          <label key={key}>
            <span className="label">{label}</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--muted)]">
                <Icon size={16} />
              </span>
              <input className="field pl-11" value={links[key] ?? ""} placeholder={placeholder}
                onChange={(e) => setLinks((cur) => ({ ...cur, [key]: e.target.value }))} />
            </div>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="neu-btn flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium">
          {saved ? <Check size={16} className="text-[var(--success)]" /> : <Save size={16} />}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </form>
  );
}
