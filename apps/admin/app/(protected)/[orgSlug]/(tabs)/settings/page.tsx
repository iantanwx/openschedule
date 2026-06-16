import { use } from "react";
import { SettingsPage } from "@/components/settings-page";

export default function SettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <SettingsPage orgSlug={orgSlug} />;
}
