import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { MobileOrgNav } from "@/components/mobile-org-nav";

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
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
