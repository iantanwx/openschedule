import { use } from "react";
import { TodayPage } from "@/components/today-page";

export default function VenueTodayRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <TodayPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
