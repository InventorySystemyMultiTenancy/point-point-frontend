import React from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  valueClassName?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  color,
  valueClassName = "text-stone-900",
}) => (
  <div className={`rounded-xl border-l-4 bg-white p-5 shadow-lg ${color}`}>
    <p className="text-sm font-medium text-stone-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${valueClassName}`}>{value}</p>
  </div>
);

export default StatCard;
