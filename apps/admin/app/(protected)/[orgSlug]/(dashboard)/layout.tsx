import { MobileOrgNav } from "@/components/mobile-org-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileOrgNav className="md:hidden" />
      {children}
    </>
  );
}
