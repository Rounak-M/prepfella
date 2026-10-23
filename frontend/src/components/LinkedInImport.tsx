"use client";

import { useState, type FormEvent } from "react";

import { api, ApiError, linkedinForm, type CareerEntry } from "@/lib/api";
import { LinkedInSource } from "./LinkedInSource";
import { Modal } from "./Modal";

/** Fill the career graph from LinkedIn: positions + education. Salaries aren't on LinkedIn, so they stay empty. */
export function LinkedInImport({ onClose, onImported }: { onClose: () => void; onImported: (added: number) => void }) {
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [needPdf, setNeedPdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addedSoFar, setAddedSoFar] = useState(0); // from a link import that still needs the PDF for its jobs

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ added: number; entries: CareerEntry[]; hidden_jobs: number }>("/profile/linkedin/import", {
        method: "POST",
        body: linkedinForm(url, pdf),
      });
      const added = addedSoFar + res.added;
      if (res.hidden_jobs && !pdf) {
        // The public page blurs job titles and leaves out job dates; only the PDF export has them.
        const jobs = res.hidden_jobs === 1 ? "job" : `${res.hidden_jobs} jobs`;
        setAddedSoFar(added);
        setNeedPdf(`${added ? `Added ${added} ${added === 1 ? "entry" : "entries"} from the link. ` : ""}LinkedIn hides job titles and dates from people who aren't signed in, so your ${jobs} couldn't be read from the link.`);
        setBusy(false);
        return;
      }
      onImported(added);
    } catch (err) {
      if (err instanceof ApiError && err.code === "linkedin_unavailable") setNeedPdf(err.message);
      setError(err instanceof ApiError ? err.message : "Import failed");
      setBusy(false);
    }
  }

  return (
    <Modal title="Import from LinkedIn" onClose={addedSoFar ? () => onImported(addedSoFar) : onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-[var(--muted)]">We&apos;ll add your positions and education. Existing entries are kept; add salaries afterwards.</p>
        <LinkedInSource url={url} pdf={pdf} onUrl={setUrl} onPdf={setPdf} needPdf={needPdf} />
        {error && !needPdf && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={addedSoFar ? () => onImported(addedSoFar) : onClose} className="neu-btn rounded-2xl px-5 py-2.5 text-sm">
            {addedSoFar ? "Done" : "Cancel"}
          </button>
          <button type="submit" disabled={busy || (!url.trim() && !pdf) || (!!needPdf && !pdf)} className="btn-primary rounded-2xl px-6 py-2.5 text-sm font-medium">
            {busy ? "Importing…" : needPdf ? "Import from PDF" : "Import"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
