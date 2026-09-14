"use client";

import { Inbox, FileText, MapPin, FolderOpen, Users, Building2, Bell, Mail, AlertCircle } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  inbox: <Inbox className="h-12 w-12 text-muted" />,
  reports: <FileText className="h-12 w-12 text-muted" />,
  map: <MapPin className="h-12 w-12 text-muted" />,
  folder: <FolderOpen className="h-12 w-12 text-muted" />,
  users: <Users className="h-12 w-12 text-muted" />,
  org: <Building2 className="h-12 w-12 text-muted" />,
  bell: <Bell className="h-12 w-12 text-muted" />,
  mail: <Mail className="h-12 w-12 text-muted" />,
  alert: <AlertCircle className="h-12 w-12 text-muted" />,
};

export function EmptyState({ icon = "inbox", title, message }: EmptyStateProps) {
  const iconNode = typeof icon === "string" ? ICON_MAP[icon] || ICON_MAP.inbox : icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
        {iconNode}
      </div>
      <h3 className="mt-4 text-xl font-bold text-foreground">{title}</h3>
      {message && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

export default EmptyState;