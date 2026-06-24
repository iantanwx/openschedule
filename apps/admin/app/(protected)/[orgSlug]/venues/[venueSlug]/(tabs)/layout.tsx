import { TabBar } from "@/components/tab-bar";
import { MobileTopBar } from "@/components/mobile-top-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <MobileTopBar mode="venue" className="md:hidden" />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <TabBar className="md:hidden" />
    </div>
  );
}
