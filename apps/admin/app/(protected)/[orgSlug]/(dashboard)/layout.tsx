import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { MobileOrgNav } from "@/components/mobile-org-nav";
import { VenueSwitcherBar } from "@/components/venue-switcher-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <MobileTopBar mode="org" className="md:hidden" />
        <MobileOrgNav className="md:hidden" />
        <div className="hidden md:flex items-center border-b px-4 py-2">
          <VenueSwitcherBar />
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
