"use client";

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CareerEntry } from "@/lib/api";
import { careerSeries, formatYears, type GraphPoint } from "@/lib/career";
import { FLOW, FlowGradient, FlowLegend, flowLine, pulseDot, YearTick } from "./charts/flow";

/** Seniority (left axis) and salary in LPA (right axis) over time, as flowing gradient curves. */
export function CareerGraph({ entries, levels }: { entries: CareerEntry[]; levels: Record<string, string> }) {
  const data = careerSeries(entries);
  if (data.length < 2) {
    return (
      <div className="neu-inset grid min-h-72 flex-1 place-items-center rounded-3xl p-6 text-center text-sm text-[var(--muted)]">
        Add your internships and jobs, or import them from LinkedIn, to see your career graph.
      </div>
    );
  }
  const hasSalary = data.some((d) => (d.lpa ?? 0) > 0);
  const maxLevel = Math.max(3, ...data.map((d) => d.level ?? 0));
  const years = Array.from(
    { length: Math.ceil(data.at(-1)!.t) - Math.floor(data[0].t) + 1 },
    (_, i) => Math.floor(data[0].t) + i,
  ).filter((y) => y >= data[0].t && y <= data.at(-1)!.t);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <FlowLegend items={[{ label: "Seniority", palette: FLOW.deep }, ...(hasSalary ? [{ label: "Salary (LPA)", palette: FLOW.pink }] : [])]} />
      {/* grows to fill the tile (whose height matches the sidebar on desktop); the chart measures this box */}
      <div className="relative min-h-72 w-full flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: hasSalary ? 4 : 16, bottom: 4, left: 4 }}>
              <defs>
                <FlowGradient id="flowLevel" palette={FLOW.deep} />
                <FlowGradient id="flowSalary" palette={FLOW.pink} />
              </defs>
              <CartesianGrid stroke="var(--track)" horizontal={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[data[0].t, data.at(-1)!.t]}
                ticks={years}
                tick={<YearTick format={(t) => String(Math.round(Number(t)))} />}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="level"
                domain={[0, maxLevel]}
                ticks={Array.from({ length: maxLevel + 1 }, (_, i) => i)}
                tickFormatter={(v: number) => levels[v] ?? ""}
                width={92}
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              {hasSalary && (
                <YAxis
                  yAxisId="lpa"
                  orientation="right"
                  tickFormatter={(v: number) => `₹${v}L`}
                  width={48}
                  stroke="var(--muted)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
              )}
              <Tooltip content={<GraphTooltip levels={levels} />} cursor={{ stroke: "var(--muted)", strokeOpacity: 0.5 }} />
              {/* salary first so the seniority line stays on top where both sit at zero */}
              {hasSalary && (
                <Line
                  yAxisId="lpa"
                  name="Salary (LPA)"
                  dataKey="lpa"
                  type="basis"
                  stroke="url(#flowSalary)"
                  {...flowLine}
                  activeDot={pulseDot(FLOW.pink.to)}
                  connectNulls={false}
                  animationDuration={1400}
                />
              )}
              <Line
                yAxisId="level"
                name="Seniority"
                dataKey="level"
                type="basis"
                stroke="url(#flowLevel)"
                {...flowLine}
                activeDot={pulseDot(FLOW.deep.to)}
                connectNulls={false}
                animationDuration={1400}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function GraphTooltip({ active, payload, levels }: { active?: boolean; payload?: { payload: GraphPoint }[]; levels: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="neu max-w-64 rounded-2xl p-3 text-xs">
      <div className="mb-1 font-semibold">{formatYears(p.t)}</div>
      <div>{p.gap ? `Between roles · ${levels[p.level!]}` : p.level != null ? levels[p.level] : "No role"}</div>
      {p.lpa != null && !p.gap && <div className="text-[var(--accent-pink)]">₹{p.lpa} LPA</div>}
      {p.roles.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[var(--muted)]">
          {p.roles.map((r) => (
            <li key={r.id}>
              {r.title}
              {r.organization && ` · ${r.organization}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
