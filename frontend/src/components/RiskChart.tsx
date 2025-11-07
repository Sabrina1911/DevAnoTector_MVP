// frontend/src/components/RiskChart.tsx
import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, Legend,
} from "recharts";

export type RiskPoint = { misalignDeg: number; score: number };

export type RiskSeries = {
  key: string;
  label: string;
  data: RiskPoint[];
  stroke: string;
  dashed?: boolean;
};

export default function RiskChart(props: {
  series: RiskSeries[];                 // multi-series input
  compareLabel?: string;                // optional label used in tooltip
  bands: { green: string; amber: string; red: string };
  gridColor: string;
  fg: string;
}) {
  const { series, bands, gridColor, fg, compareLabel } = props;

  // Legend toggles (one boolean per series.key)
  const initialShow = useMemo(() => {
    const obj: Record<string, boolean> = {};
    for (const s of series) obj[s.key] = true;
    return obj;
  }, [series]);
  const [show, setShow] = useState<Record<string, boolean>>(initialShow);

  // Recharts expects a single array; we render separate <Line>s per series
  // Tooltip: custom content that shows whichever series are visible.
  const DualTooltip = ({ active, label, payload }: any) => {
    if (!active || !payload?.length) return null;

    // payload contains points for all visible lines at this x
    const rows = payload
      .filter((p: any) => p && p.dataKey === "score") // each Line uses dataKey="score"
      .map((p: any) => ({
        name: p.name as string,
        color: p.stroke as string,
        value: typeof p.value === "number" ? p.value.toFixed(2) : p.value,
      }));

    return (
      <div
        style={{
          background: "rgba(17,24,39,0.92)",
          color: "white",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Misalignment: {label}°</div>
        {rows.map((r: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: 9999, background: r.color,
                display: "inline-block",
              }}
            />
            <span style={{ opacity: 0.9 }}>{r.name}:</span>
            <strong>{r.value}</strong>
          </div>
        ))}
        {compareLabel && rows.some((r: any) => r.name.toLowerCase().includes("compare")) && (
          <div style={{ marginTop: 6, opacity: 0.8 }}>Compare: {compareLabel}</div>
        )}
      </div>
    );
  };

  // Legend click: toggle that series
  const handleLegendClick = (e: any) => {
    // Recharts Legend gives “value” as the series label; find its key
    const clicked = series.find((s) => s.label === e.value);
    if (!clicked) return;
    setShow((prev) => ({ ...prev, [clicked.key]: !prev[clicked.key] }));
  };

  // x domain from whatever series has the widest extent
  const xTicks = useMemo(() => {
    const set = new Set<number>();
    series.forEach((s) => s.data.forEach((d) => set.add(d.misalignDeg)));
    return Array.from(set).sort((a, b) => a - b);
  }, [series]);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart margin={{ top: 6, right: 12, bottom: 18, left: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />

        {/* Risk bands */}
        <ReferenceArea y1={0} y2={0.35} strokeOpacity={0} fill={bands.green} style={{ pointerEvents: "none" as any }} />
        <ReferenceArea y1={0.35} y2={0.65} strokeOpacity={0} fill={bands.amber} style={{ pointerEvents: "none" as any }} />
        <ReferenceArea y1={0.65} y2={1} strokeOpacity={0} fill={bands.red} style={{ pointerEvents: "none" as any }} />

        <XAxis
          dataKey="misalignDeg"
          type="number"
          ticks={xTicks}
          domain={[Math.min(...xTicks, 0), Math.max(...xTicks, 20)]}
          stroke={fg}
          tick={{ fontSize: 11 }}
          label={{ value: "Misalignment (°)", position: "insideBottom", offset: -6, fill: fg }}
        />
        <YAxis domain={[0, 1]} stroke={fg} tick={{ fontSize: 11 }} />

        <Tooltip content={<DualTooltip />} />
        <Legend onClick={handleLegendClick} />

        {/* Render each series as its own <Line> */}
        {series.map((s) => (
          <Line
            key={s.key}
            data={s.data}
            type="monotone"
            dataKey="score"
            name={s.label}
            stroke={s.stroke}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "6 4" : undefined}
            dot={false}
            hide={!show[s.key]}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
