import { use } from "react";
import { OrgSettingsWrapper } from "@/components/org-settings-wrapper";

export default function OrgSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return (
    <div className="p-4">
      <OrgSettingsWrapper orgSlug={orgSlug} />
    </div>
  );
}
