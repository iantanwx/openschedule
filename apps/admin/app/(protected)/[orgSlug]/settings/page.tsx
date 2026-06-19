import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";
import { OrgSettingsWrapper } from "@/components/org-settings-wrapper";

export default function OrgSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1 p-4">
        <OrgSettingsWrapper orgSlug={orgSlug} />
      </main>
    </div>
  );
}
