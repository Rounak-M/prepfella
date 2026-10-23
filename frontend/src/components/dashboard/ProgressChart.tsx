"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FLOW, FlowGradient, FlowLegend, flowLine, pulseDot, type FlowPalette } from "@/components/charts/flow";
import { api, DIMENSIONS, DIMENSION_LABELS, type Dimension, type ProgressPoint } from "@/lib/api";
import { formatDate } from "@/lib/sessions";

const DIM_PALETTES: Record<Dimension, FlowPalette> = {
  communication: FLOW.cyan,
  technical: FLOW.indigo,
  problem_solving: FLOW.pink,
  answer_quality: FLOW.miami,
};

/** Overall interview score per finished session (thick line) with the four dimensions as thin lines, all 0–100. */
export function ProgressChart() {
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);

  useEffect(() => {
    api<ProgressPoint[]>("/progress").then(setPoints).catch(() => setPoints([]));
  }, []);

  if (!points) return <div className="neu-inset min-h-72 flex-1 animate-pulse rounded-3xl" />;
  if (!points.length) {
    return (
      <div className="neu-inset flex min-h-72 flex-1 flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center text-sm text-[var(--muted)]">
        Finish your first mock interview to see your progress here.
        <Link href="/setup" className="btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium">
          Start an interview <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  // Dimensions are 0–10; scale ×10 so everything shares the 0–100 axis.
  const data = points.map((p, i) => ({
    n: i + 1,
    date: formatDate(p.date, { day: "numeric", month: "short" }),
    role: p.role,
    overall: p.overall,
    ...Object.fromEntries(DIMENSIONS.map((d) => [d, Math.round(p.averages[d] * 10)])),
  }));

  // One interview = one point: a dot-less line would draw nothing, so show the points then.
  const single = data.length === 1;

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="relative min-h-64 w-full flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: -12 }}>
              <defs>
                <FlowGradient id="flowOverall" palette={FLOW.brand} />
                {DIMENSIONS.map((d) => (
                  <FlowGradient key={d} id={`flow-${d}`} palette={DIM_PALETTES[d]} />
                ))}
              </defs>
              <CartesianGrid stroke="var(--track)" horizontal={false} />
              <XAxis dataKey="date" stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} padding={{ left: 16, right: 16 }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip
                cursor={{ stroke: "var(--muted)", strokeOpacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="neu rounded-2xl p-3 text-xs">
                      <div className="font-semibold">
                        #{p.n} · {p.date}
                    </div>
                    <div className="mb-1 text-[var(--muted)]">{p.role}</div>
                    <div className="font-semibold">Overall {p.overall}</div>
                    {DIMENSIONS.map((d) => (
                      <div key={d} className="text-[var(--muted)]">
                        {DIMENSION_LABELS[d]} {(p[d as keyof typeof p] as number) / 10}
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {DIMENSIONS.map((d) => (
              <Line key={d} dataKey={d} name={DIMENSION_LABELS[d]} type="monotone" stroke={`url(#flow-${d})`} {...flowLine} strokeWidth={2.5}
                strokeOpacity={0.85} activeDot={false} dot={single ? { r: 3, fill: DIM_PALETTES[d].to, strokeWidth: 0 } : false} animationDuration={1400} />
            ))}
            <Line
              dataKey="overall"
              name="Overall"
              type="monotone"
              stroke="url(#flowOverall)"
              {...flowLine}
              dot={single ? { r: 5, fill: FLOW.brand.to, stroke: "#fff", strokeWidth: 1.5 } : false}
              activeDot={pulseDot(FLOW.brand.to)}
              animationDuration={1400}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
      <FlowLegend items={[{ label: "Overall", palette: FLOW.brand }, ...DIMENSIONS.map((d) => ({ label: DIMENSION_LABELS[d], palette: DIM_PALETTES[d], thin: true }))]} />
    </div>
  );
}
