"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  [key: string]: string | number | null;
}

interface TrendChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  label?: string;
  type?: "line" | "area" | "bar";
  color?: string;
  unit?: string;
  referenceValue?: number;
  referenceLabel?: string;
  height?: number;
}

export default function TrendChart({
  data,
  xKey,
  yKey,
  label,
  type = "area",
  color = "#6366f1",
  unit = "",
  referenceValue,
  referenceLabel,
  height = 280,
}: TrendChartProps) {
  const formatter = (v: number) => `${v.toFixed(2)}${unit}`;

  const commonProps = {
    data,
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };

  const axisProps = {
    xAxis: (
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        axisLine={false}
        tickLine={false}
      />
    ),
    yAxis: (
      <YAxis
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => `${v}${unit}`}
        width={45}
      />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />,
    tooltip: (
      <Tooltip
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter={(v: any) => [typeof v === "number" ? formatter(v) : String(v ?? ""), label || yKey]}
        labelStyle={{ color: "#374151", fontWeight: 600 }}
        contentStyle={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          fontSize: 12,
        }}
      />
    ),
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {referenceValue !== undefined && (
              <ReferenceLine
                y={referenceValue}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: referenceLabel || "", fontSize: 11, fill: "#ef4444" }}
              />
            )}
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === "area" ? (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {referenceValue !== undefined && (
              <ReferenceLine y={referenceValue} stroke="#ef4444" strokeDasharray="4 4" />
            )}
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${yKey})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        ) : (
          <LineChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {referenceValue !== undefined && (
              <ReferenceLine y={referenceValue} stroke="#ef4444" strokeDasharray="4 4" />
            )}
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
