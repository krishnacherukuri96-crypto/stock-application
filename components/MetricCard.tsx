"use client";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  change?: number;
  badge?: string;
  badgeColor?: "green" | "red" | "yellow" | "blue" | "gray";
}

const badgeColors = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-700",
};

export default function MetricCard({
  label,
  value,
  sub,
  change,
  badge,
  badgeColor = "gray",
}: MetricCardProps) {
  const changeColor =
    change === undefined ? "" : change >= 0 ? "text-green-600" : "text-red-600";
  const changeSign = change !== undefined && change > 0 ? "+" : "";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {badge && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      {(sub || change !== undefined) && (
        <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500">
          {sub && <span>{sub}</span>}
          {change !== undefined && (
            <span className={`font-medium ${changeColor}`}>
              {changeSign}{change.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
