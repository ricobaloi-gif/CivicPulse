"use client";

import { SEVERITY_COLORS } from "@/src/lib/constants";

interface SeverityBadgeProps {
  severity: string;
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "sm" }: SeverityBadgeProps) {
  const colors = SEVERITY_COLORS[severity] ?? {
    bg: "bg-gray-800/50",
    text: "text-gray-300",
    border: "border-gray-700",
  };

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-0.5 text-xs"
      : "px-3 py-1 text-sm";

  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium capitalize ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}`}
    >
      {label}
    </span>
  );
}

export default SeverityBadge;
