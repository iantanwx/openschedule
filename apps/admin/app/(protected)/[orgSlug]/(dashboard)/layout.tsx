import { MobileOrgNav } from "@/components/mobile-org-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <MobileOrgNav className="md:hidden" />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
