import { use } from "react";
import { TodayPage } from "@/components/today-page";

export default function TodayRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <TodayPage orgSlug={orgSlug} venueSlug="" />;
}
