"use client";

import { FileText, Upload } from "lucide-react";
import { useRef } from "react";

import { LinkedInIcon } from "./icons";

/** Link field + optional "Save to PDF" upload, shared by the LinkedIn review and the career import. */
export function LinkedInSource({
  url,
  pdf,
  onUrl,
  onPdf,
  needPdf,
}: {
  url: string;
  pdf: File | null;
  onUrl: (v: string) => void;
  onPdf: (f: File | null) => void;
  needPdf?: string | null; // why the link failed; shown as a prompt to upload the PDF
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <label>
        <span className="label">Profile link</span>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--muted)]">
            <LinkedInIcon size={16} />
          </span>
          <input className="field pl-11" value={url} onChange={(e) => onUrl(e.target.value)} placeholder="https://www.linkedin.com/in/your-name" />
        </div>
      </label>
      <div className={`rounded-2xl p-3 text-sm ${needPdf ? "neu-inset" : ""}`}>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => input.current?.click()} className="neu-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm">
            {pdf ? <FileText size={16} className="text-[var(--primary)]" /> : <Upload size={16} />}
            {pdf ? pdf.name : "Upload profile PDF"}
          </button>
          {pdf && (
            <button type="button" className="text-xs text-[var(--muted)] underline" onClick={() => onPdf(null)}>
              remove
            </button>
          )}
        </div>
        <p className={`mt-2 text-xs ${needPdf ? "text-[var(--accent-pink)]" : "text-[var(--muted)]"}`}>
          {needPdf ? `${needPdf} Upload the PDF instead: ` : "Optional, for a deeper review: "}
          on LinkedIn open your profile → <b>More</b> → <b>Save to PDF</b>, then upload it here.
        </p>
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => onPdf(e.target.files?.[0] ?? null)} />
      </div>
    </div>
  );
}
