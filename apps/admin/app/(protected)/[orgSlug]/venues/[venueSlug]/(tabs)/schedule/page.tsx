import { use } from "react";
import { SchedulePage } from "@/components/schedule-page";

export default function VenueScheduleRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <SchedulePage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
