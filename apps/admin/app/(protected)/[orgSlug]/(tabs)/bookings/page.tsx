import { use } from "react";
import { BookingsPage } from "@/components/bookings-page";

export default function BookingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <BookingsPage orgSlug={orgSlug} venueSlug="" />;
}
