import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";
import { TeamSection } from "@/components/team-section";

export default function TeamRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1 p-4">
        <TeamSection />
      </main>
    </div>
  );
}
