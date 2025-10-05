// components/WeeklyResultsChart.tsx
"use client";
import WebOnly from "./WebOnly";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";

export type WeeklyResult = { week: number; wins: number; losses: number };

export default function WeeklyResultsChart({
  data,
  height = 280,
  title,
}: {
  data: WeeklyResult[];
  height?: number;
  title?: string;
}) {
  return (
    <WebOnly>
      <div style={{ width: "100%", height }}>
        {title ? (
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="wins" stackId="a" />
            <Bar dataKey="losses" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WebOnly>
  );
}
