import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <MobileTopBar mode="venue" className="md:hidden" />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <TabBar className="md:hidden" />
      </div>
    </div>
  );
}
