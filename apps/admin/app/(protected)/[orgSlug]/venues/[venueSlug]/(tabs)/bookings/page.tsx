import { use } from "react";
import { BookingsPage } from "@/components/bookings-page";

export default function VenueBookingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <BookingsPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
