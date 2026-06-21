import { use } from "react";
import { TeamSection } from "@/components/team-section";

export default function TeamRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  use(params);
  return (
    <div className="p-4">
      <TeamSection />
    </div>
  );
}
