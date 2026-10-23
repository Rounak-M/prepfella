"use client";

import { FileText, FileUp, Type } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { api, ApiError, type Profile } from "@/lib/api";

/** Resume as a PDF (drag-and-drop or picker) or pasted text → POST /profile/resume. Replacing it clears the old review. */
export function ResumeCard({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!profile.has_resume);
  const input = useRef<HTMLInputElement>(null);

  async function send(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<Profile>("/profile/resume", { method: "POST", body: form }));
      setEditing(false);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function sendPdf(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file");
      return;
    }
    const form = new FormData();
    form.set("pdf", file);
    send(form);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    sendPdf(e.dataTransfer.files?.[0]);
  }

  return (
    <section className="neu flex flex-col gap-4 rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resume</h2>
          <p className="text-sm text-[var(--muted)]">
            {profile.has_resume ? `${profile.resume_chars.toLocaleString("en-IN")} characters stored` : "Upload it so questions can follow your projects."}
          </p>
        </div>
        {profile.has_resume && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="neu-btn ml-auto rounded-2xl px-4 py-2 text-sm">
            Replace
          </button>
        )}
      </div>

      {profile.has_resume && !editing ? (
        <div className="neu-inset rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            <FileText size={14} /> Preview
          </div>
          <p className="line-clamp-6 text-sm whitespace-pre-line text-[var(--muted)]">{profile.resume_preview}</p>
        </div>
      ) : (
        <>
          <div className="neu-inset flex gap-1 self-start rounded-2xl p-1">
            {(["pdf", "text"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${mode === m ? "neu font-medium text-[var(--primary)]" : "text-[var(--muted)]"}`}>
                {m === "pdf" ? <FileUp size={15} /> : <Type size={15} />} {m === "pdf" ? "Upload PDF" : "Paste text"}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              disabled={busy}
              className={`neu-inset flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging ? "border-[var(--primary)]" : "border-transparent"
              }`}
            >
              <span className="btn-primary grid size-12 place-items-center rounded-2xl">
                <FileUp size={20} />
              </span>
              <span className="font-medium">{busy ? "Reading your resume…" : "Drop your resume PDF here"}</span>
              <span className="text-xs text-[var(--muted)]">or click to choose a file</span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea className="field min-h-48 resize-y" value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full text of your resume…" aria-label="Resume text" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">{text.trim().length < 200 ? "At least 200 characters" : `${text.trim().length} characters`}</span>
                <button type="button" disabled={busy || text.trim().length < 200}
                  onClick={() => {
                    const form = new FormData();
                    form.set("text", text);
                    send(form);
                  }}
                  className="btn-primary rounded-2xl px-5 py-2.5 text-sm font-medium">
                  {busy ? "Saving…" : "Save resume"}
                </button>
              </div>
            </div>
          )}
          {profile.has_resume && (
            <button type="button" onClick={() => setEditing(false)} className="self-start text-xs text-[var(--muted)] underline">
              Keep the current resume
            </button>
          )}
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => sendPdf(e.target.files?.[0])} />
        </>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </section>
  );
}
