"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import {
  Plus,
  FileText,
  FolderOpen,
  MapPin,
  User,
  Mail,
  Building2,
  BarChart3,
  Briefcase,
  Shield,
  ArrowRight,
} from "lucide-react";

interface CardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  colorClass: string;
}

function ActionCard({ icon: Icon, title, description, href, colorClass }: CardProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`group card-interactive ${colorClass}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <p className="mt-4 font-semibold text-sm transition-colors group-hover:text-foreground">
            Open <ArrowRight className="inline h-3.5 w-3.5 ml-1" />
          </p>
        </div>
      </div>
    </button>
  );
}

function ToolCard({ icon: Icon, title, description, href, colorClass }: CardProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`group card-interactive ${colorClass}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();

  const role = profile?.role?.toLowerCase().trim() || "resident";
  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";
  const displayName = profile?.name?.trim() || user?.email?.split("@")[0] || "Resident";

  const hasOrg = !!profile?.organizationId;
  const orgName = profile?.organizationName;

  return (
    <Layout title="Dashboard">
      <section className="mb-10">
        <h2 className="page-title">Welcome, {displayName}</h2>
        <p className="page-description">
          Help improve your community by reporting local problems,
          confirming issues reported by others and following their
          progress.
        </p>
        {hasOrg && orgName && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Organisation: <span className="text-foreground">{orgName}</span>
            </span>
          </div>
        )}
      </section>

      {isStaff && (
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <ActionCard
            icon={Briefcase}
            title="My Assigned Cases"
            description="View and manage reports assigned directly to you."
            href="/staff"
            colorClass="border-indigo-800/50 bg-indigo-950/20 hover:border-indigo-500/50"
          />

          {isAdmin && (
            <ActionCard
              icon={Shield}
              title="CivicPulse Operations"
              description="Review all reports, prioritise cases and manage assignments."
              href="/admin"
              colorClass="border-blue-800/50 bg-blue-950/20 hover:border-blue-500/50"
            />
          )}
        </section>
      )}

      <section className="mb-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Community Tools
        </h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ToolCard
            icon={Plus}
            title="Report an Issue"
            description="Submit a new community issue with photo and location."
            href="/report/new"
            colorClass="hover:border-primary/50"
          />

          <ToolCard
            icon={FileText}
            title="Browse Reports"
            description="Explore issues reported by the community."
            href="/reports"
            colorClass="hover:border-purple-500/50"
          />

          <ToolCard
            icon={FolderOpen}
            title="My Reports"
            description="Track issues you personally submitted."
            href="/my-reports"
            colorClass="hover:border-success/50"
          />

          <ToolCard
            icon={MapPin}
            title="Community Map"
            description="View reported issues geographically."
            href="/map"
            colorClass="hover:border-warning/50"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Account & Organisation
        </h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ToolCard
            icon={User}
            title="My Profile"
            description="Manage your personal information and settings."
            href="/profile"
            colorClass="hover:border-border-strong"
          />

          {!hasOrg && (
            <>
              <ToolCard
                icon={Mail}
                title="Pending Invitations"
                description="Check and respond to organisation invites."
                href="/organization/invites"
                colorClass="border-warning/30 bg-warning-muted/20 hover:border-warning/50"
              />

              <ToolCard
                icon={Building2}
                title="Create Organisation"
                description="Set up a new organisation to manage civic reports."
                href="/organization/setup"
                colorClass="hover:border-teal-500/50"
              />
            </>
          )}

          {isAdmin && (
            <ToolCard
              icon={BarChart3}
              title="Analytics"
              description="View organisation statistics and performance metrics."
              href="/analytics"
              colorClass="hover:border-pink-500/50"
            />
          )}
        </div>
      </section>
    </Layout>
  );
}