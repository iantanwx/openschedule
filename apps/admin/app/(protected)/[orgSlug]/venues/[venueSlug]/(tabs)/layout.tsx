import { TopBar } from "@/components/top-bar";
import { VenueTabs } from "@/components/venue-tabs";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar className="hidden md:flex" />
      <VenueTabs className="hidden md:flex" />
      <MobileTopBar mode="venue" className="md:hidden" />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <TabBar className="md:hidden" />
    </div>
  );
}
