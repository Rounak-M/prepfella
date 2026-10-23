"use client";

import { useEffect, useState } from "react";

const STEPS = ["Reading your answer…", "Scoring four dimensions…", "Checking it against your resume…", "Choosing the next question…"];

/** Shown while an answer is scored (~5 s). Cycles through what the AI is doing so the wait feels purposeful. */
export function ThinkingIndicator({ steps = STEPS }: { steps?: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), 1600);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center gap-4 py-6" role="status" aria-live="polite">
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="size-3 rounded-full bg-[image:var(--primary-gradient)] motion-safe:animate-bounce"
            style={{ animationDelay: `${d * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">{steps[i % steps.length]}</p>
    </div>
  );
}
