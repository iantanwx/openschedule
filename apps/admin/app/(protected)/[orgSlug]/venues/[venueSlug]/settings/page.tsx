import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1">
        <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
      </main>
    </div>
  );
}
