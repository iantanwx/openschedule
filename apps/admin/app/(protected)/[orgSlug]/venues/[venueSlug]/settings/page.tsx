import { use } from "react";
import { TabBar } from "@/components/tab-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <>
      <div className="flex-1 pb-16 md:pb-0">
        <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
      </div>
      <TabBar className="md:hidden" />
    </>
  );
}
