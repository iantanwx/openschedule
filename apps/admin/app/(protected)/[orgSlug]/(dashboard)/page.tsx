import { use } from "react";
import { OrgDashboardPage } from "@/components/org-dashboard-page";

export default function DashboardRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <OrgDashboardPage orgSlug={orgSlug} />;
}
