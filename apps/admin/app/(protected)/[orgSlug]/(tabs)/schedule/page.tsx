import { use } from "react";
import { SchedulePage } from "@/components/schedule-page";

export default function ScheduleRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <SchedulePage orgSlug={orgSlug} venueSlug="" />;
}
