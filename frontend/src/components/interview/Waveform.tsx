"use client";

import { useEffect, useRef } from "react";

import { micLevel } from "@/lib/audio";

const BARS = 28;

/** Live mic level as a row of bars. Heights are set straight on the DOM each frame, so React doesn't re-render. */
export function Waveform({ analyser }: { analyser: AnalyserNode | null }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!analyser) return;
    const history = new Array(BARS).fill(0);
    const buf = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let raf = 0;
    const tick = () => {
      if (frame++ % 3 === 0) {
        history.shift();
        history.push(micLevel(analyser, buf));
        history.forEach((v, i) => {
          const el = bars.current[i];
          if (el) el.style.transform = `scaleY(${0.08 + v * 0.92})`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <div className="flex h-14 items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="h-full w-1.5 origin-center rounded-full bg-[image:var(--primary-gradient)] transition-transform duration-75"
          style={{ transform: "scaleY(0.08)" }}
        />
      ))}
    </div>
  );
}
