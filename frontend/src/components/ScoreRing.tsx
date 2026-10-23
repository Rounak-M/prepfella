// Circular score like the "Monthly Progress" ring in the design reference. value: 0–100.
export function ScoreRing({ value, size = 150, label }: { value: number; size?: number; label?: string }) {
  const stroke = 12;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="neu-inset relative grid place-items-center rounded-full" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            {/* light cyan in both themes (matches the chart lines); the shadow keeps it crisp on light glass */}
            <stop offset="0" stopColor="#e6fdff" />
            <stop offset="1" stopColor="#9cf0ff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: "stroke-dashoffset 900ms ease", filter: "drop-shadow(0 1px 2px rgb(60 10 130 / 0.4))" }}
        />
      </svg>
      <div className="relative text-center">
        <div className="text-4xl font-semibold tabular-nums">{value}</div>
        {label && <div className="text-xs text-[var(--muted)]">{label}</div>}
      </div>
    </div>
  );
}
