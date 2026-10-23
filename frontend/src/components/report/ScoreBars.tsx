"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DIMENSIONS, DIMENSION_LABELS, type Dimension, type Scores } from "@/lib/api";

/** Four dimension averages (0–10) as horizontal bars; the weakest is highlighted in pink. */
export function ScoreBars({ averages, weakest }: { averages: Scores; weakest: Dimension }) {
  const data = DIMENSIONS.map((d) => ({ dim: d, label: DIMENSION_LABELS[d], value: averages[d] }));
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={14}>
          <defs>
            <linearGradient id="scoreBar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--primary-from)" />
              <stop offset="1" stopColor="var(--primary-to)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--track)" strokeDasharray="4 6" horizontal={false} />
          <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis type="category" dataKey="label" width={112} stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "var(--track)", opacity: 0.4 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="neu rounded-2xl px-3 py-2 text-xs">
                  <b>{payload[0].payload.label}</b>: {payload[0].payload.value}/10
                  {payload[0].payload.dim === weakest && <div className="text-[var(--accent-pink)]">Weakest area</div>}
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 10, 10, 0]} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.dim} fill={d.dim === weakest ? "var(--accent-pink)" : "url(#scoreBar)"} />
            ))}
            <LabelList dataKey="value" position="right" fill="var(--fg)" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
