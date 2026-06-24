import { MobileOrgNav } from "@/components/mobile-org-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <MobileTopBar mode="org" className="md:hidden" />
      <MobileOrgNav className="md:hidden" />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
