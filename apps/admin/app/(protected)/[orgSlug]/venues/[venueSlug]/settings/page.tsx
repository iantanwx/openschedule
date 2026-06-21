import { use } from "react";
import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { TabBar } from "@/components/tab-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <MobileTopBar mode="venue" className="md:hidden" />
        <main className="flex-1 pb-16 md:pb-0">
          <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
        </main>
        <TabBar className="md:hidden" />
      </div>
    </div>
  );
}
