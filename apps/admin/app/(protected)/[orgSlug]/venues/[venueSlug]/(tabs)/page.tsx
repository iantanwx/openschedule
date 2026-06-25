import { use } from "react";
import { CalendarPage } from "@/components/calendar-page";

export default function VenueCalendarRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <CalendarPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
