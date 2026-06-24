"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { formatNotification } from "@/lib/format-notification";
import { CalendarCheck, Clock, DollarSign, Calendar } from "lucide-react";
import { Spinner } from "@openschedule/ui/components/spinner";

interface OrgDashboardPageProps {
  orgSlug: string;
}

export function OrgDashboardPage({ orgSlug }: OrgDashboardPageProps) {
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const today = format(new Date(), "yyyy-MM-dd");

  const stats = useQuery(
    convexApi.queries.bookings.statsByOrg,
    org ? { orgId: org._id, date: today } : "skip",
  );

  const activity = useQuery(
    convexApi.queries.notifications.listOrgActivity,
    org ? { orgId: org._id, limit: 50 } : "skip",
  );

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Bookings Today"
          value={stats?.total ?? 0}
          icon={Calendar}
        />
        <StatCard
          label="Confirmed"
          value={stats?.confirmed ?? 0}
          icon={CalendarCheck}
          accent="text-emerald-600"
        />
        <StatCard
          label="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          accent="text-amber-600"
        />
        <StatCard
          label="Revenue Today"
          value={formatCurrency(stats?.revenue ?? 0)}
          icon={DollarSign}
        />
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Activity</h2>
        {activity === undefined ? (
          <Spinner size="sm" />
        ) : activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity yet
          </p>
        ) : (
          <div className="space-y-1">
            {activity.map((item) => {
              const formatted = formatNotification(item.type, item.payload as Record<string, unknown>);
              const Icon = formatted.icon;
              return (
                <div
                  key={item._id}
                  className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{formatted.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${accent ?? "text-muted-foreground"}`} />
        <div>
          <p className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
