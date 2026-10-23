// Shared "flowing line" chart style (design reference: thick, smooth, gradient lines that fade in and out, no data
// dots, a glowing pulse on the hovered point, faint vertical year guides, the current year highlighted in pink).

/** Light, bright line palettes from the PrepFella theme. Each stays in one tight hue range; a soft shadow under the
 *  line (`flowLine.className` → globals.css) keeps the pale strokes crisp on the glass in both modes. */
export const FLOW = {
  brand: { from: "#e9b8ff", to: "#d48cff" }, // light brand purple
  pink: { from: "#ffc2e6", to: "#ff8fd0" }, // light Miami pink
  cyan: { from: "#b8f6ff", to: "#7eeaff" }, // light Miami cyan
  indigo: { from: "#d6ccff", to: "#b3a4ff" },
  miami: { from: "#ffd0f0", to: "#f0b0ff" }, // pink-lilac
  deep: { from: "#a63cf2", to: "#7424d8" }, // deep brand purple (career seniority)
} as const;

export type FlowPalette = { from: string; to: string };

/**
 * Horizontal gradient for a line stroke, faded at both ends. userSpaceOnUse so a perfectly flat line still renders
 * (with the default objectBoundingBox a zero-height line gets no paint).
 */
export function FlowGradient({ id, palette }: { id: string; palette: FlowPalette }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0">
      <stop offset="0%" stopColor={palette.from} stopOpacity={0} />
      <stop offset="7%" stopColor={palette.from} stopOpacity={1} />
      <stop offset="93%" stopColor={palette.to} stopOpacity={1} />
      <stop offset="100%" stopColor={palette.to} stopOpacity={0.15} />
    </linearGradient>
  );
}

/** Line props shared by every flowing line. */
export const flowLine = { strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, dot: false as const, className: "flow-line" };

/** Hover marker: solid dot with a soft pulsing halo in the line's end colour. */
export function pulseDot(color: string) {
  function PulseDot({ cx, cy }: { cx?: number; cy?: number }) {
    if (cx == null || cy == null) return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={color} opacity={0.18}>
          <animate attributeName="r" values="9;15;9" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.32;0.08;0.32" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.3} />
        <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#5b21b6" strokeWidth={1.5} />
      </g>
    );
  }
  return PulseDot;
}

/** X-axis tick: year label, current year in Miami pink. */
export function YearTick({ x, y, payload, format }: { x?: number; y?: number; payload?: { value: number | string }; format?: (v: number | string) => string }) {
  if (x == null || y == null || !payload) return <g />;
  const label = format ? format(payload.value) : String(payload.value);
  const current = label === String(new Date().getFullYear());
  return (
    <text x={x} y={y + 14} textAnchor="middle" fontSize={12} fontWeight={current ? 600 : 400} fill={current ? "#ff4fb8" : "var(--muted)"}>
      {label}
    </text>
  );
}

/** Small HTML legend (Recharts' built-in legend can't draw gradient strokes). */
export function FlowLegend({ items }: { items: { label: string; palette: FlowPalette; thin?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block rounded-full ${i.thin ? "h-1 w-4" : "h-1.5 w-5"}`} style={{ background: `linear-gradient(90deg, ${i.palette.from}, ${i.palette.to})` }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
