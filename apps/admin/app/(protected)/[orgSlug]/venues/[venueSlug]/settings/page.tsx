import { use } from "react";
import { TabBar } from "@/components/tab-bar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <>
      <MobileTopBar mode="venue" className="md:hidden" />
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
      </div>
      <TabBar className="md:hidden" />
    </>
  );
}
