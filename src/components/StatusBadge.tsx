"use client";

import { STATUS_CONFIG } from "@/src/lib/constants";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-800/50",
    text: "text-gray-300",
    border: "border-gray-700",
    icon: "📋",
  };

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-0.5 text-xs"
      : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

export default StatusBadge;
