"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  type PieLabelRenderProps,
} from "recharts";

const GOLD = "oklch(0.80 0.12 75)";
const GOLD_DIM = "oklch(0.65 0.08 75)";
const COLORS = [GOLD, "#4ade80", "#60a5fa", "#f472b6", "#a78bfa"];

const tooltipStyle = {
  contentStyle: {
    background: "oklch(0.14 0.005 250)",
    border: "1px solid oklch(1 0 0 / 10%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "oklch(0.85 0.02 80)",
  },
};

export function ActivityChart({ data }: { data: { day: string; scans: number; issues: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
            <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.5 0 0)" }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0 0)" }} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey="scans" stroke={GOLD} fill="url(#goldGrad)" strokeWidth={2} name="Scans" />
        <Area type="monotone" dataKey="issues" stroke="#4ade80" fill="url(#greenGrad)" strokeWidth={2} name="Issues Found" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScanTypeChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).map(([name, value]) => ({ name, value }));
  if (entries.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={entries}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }: PieLabelRenderProps) => `${name ?? ""} ${(((percent as number) ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {entries.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.8} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopReposChart({ data }: { data: { repo: string; count: number; avg_score: number }[] }) {
  if (data.length === 0) return null;

  const formatted = data.map((d) => ({
    ...d,
    shortName: d.repo.split("/").pop() || d.repo,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
        <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: "oklch(0.5 0 0)" }} />
        <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0 0)" }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} opacity={0.8} name="Passing Issues" />
      </BarChart>
    </ResponsiveContainer>
  );
}
