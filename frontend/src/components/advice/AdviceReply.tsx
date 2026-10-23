import { BookOpen, CirclePlay, Dumbbell, ExternalLink, GraduationCap, Route } from "lucide-react";
import type { ReactNode } from "react";

import type { AdviceResource } from "@/lib/api";

const TYPE: Record<AdviceResource["type"], { label: string; icon: typeof BookOpen }> = {
  course: { label: "Course", icon: GraduationCap },
  youtube: { label: "YouTube", icon: CirclePlay },
  docs: { label: "Guide", icon: BookOpen },
  practice: { label: "Practice", icon: Dumbbell },
  roadmap: { label: "Roadmap", icon: Route },
};

/** Fella's roadmap: section labels, phase headings, bullets with [n] links, then numbered resource cards. */
export function AdviceReply({ content, resources: raw }: { content: string; resources: AdviceResource[] }) {
  const resources = raw.map((r, i) => ({ ...r, n: r.n ?? i + 1 })); // older replies have no numbers
  const byN = new Map(resources.map((r) => [r.n, r]));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
        {content.split("\n").map((line, i) => (
          <Line key={i} line={line.trim()} byN={byN} />
        ))}
      </div>
      {resources.length > 0 && (
        <div>
          <div className="label">Free resources</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {resources.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ line, byN }: { line: string; byN: Map<number, AdviceResource> }) {
  if (!line) return <div className="h-1" />;
  const label = line.match(/^(Goal|Build|Today):\s*(.*)$/i);
  if (label) {
    return (
      <p className="mt-1">
        <b className="text-[var(--primary)]">{label[1]}:</b> {withRefs(label[2], byN)}
      </p>
    );
  }
  if (/^Phase\b/i.test(line)) return <h3 className="mt-3 font-semibold">{withRefs(line, byN)}</h3>;
  const bullet = line.match(/^(?:[-•]|\d+[.)])\s+(.*)$/);
  if (bullet) {
    return (
      <p className="flex gap-2 pl-1">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
        <span>{withRefs(bullet[1], byN)}</span>
      </p>
    );
  }
  return <p>{withRefs(line, byN)}</p>;
}

/** "[2]" in the text becomes a small chip linking straight to that resource. */
function withRefs(text: string, byN: Map<number, AdviceResource>): ReactNode[] {
  return text.split(/(\[\d+\])/).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    const r = m ? byN.get(Number(m[1])) : undefined;
    if (!r) return part;
    return (
      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" title={`${r.title} · ${r.provider}`}
        className="neu-btn mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 align-[1px] text-[10px] font-semibold">
        {r.n}
      </a>
    );
  });
}

function ResourceCard({ r }: { r: AdviceResource }) {
  const { label, icon: Icon } = TYPE[r.type] ?? TYPE.docs;
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      className="neu-inset group flex items-start gap-3 rounded-2xl p-3 transition hover:-translate-y-0.5">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[image:var(--primary-gradient)] text-white">
        <Icon size={18} />
        <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-[#4c1d95]">{r.n}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
          {r.provider} · {label}
          <span className="rounded-full border border-current px-1.5 text-[10px] leading-4 text-[var(--success)]">Free</span>
        </span>
      </span>
      <ExternalLink size={14} className="mt-1 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--fg)]" aria-hidden />
    </a>
  );
}
