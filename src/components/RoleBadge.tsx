"use client";

interface RoleBadgeProps {
  role: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: "bg-blue-950/50", text: "text-blue-300", border: "border-blue-800" },
  staff: { bg: "bg-indigo-950/50", text: "text-indigo-300", border: "border-indigo-800" },
  owner: { bg: "bg-purple-950/50", text: "text-purple-300", border: "border-purple-800" },
  manager: { bg: "bg-cyan-950/50", text: "text-cyan-300", border: "border-cyan-800" },
  viewer: { bg: "bg-teal-950/50", text: "text-teal-300", border: "border-teal-800" },
  resident: { bg: "bg-gray-800/50", text: "text-gray-300", border: "border-gray-700" },
  member: { bg: "bg-gray-800/50", text: "text-gray-300", border: "border-gray-700" },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const colors = ROLE_COLORS[role] ?? ROLE_COLORS.resident;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {role}
    </span>
  );
}

export default RoleBadge;
