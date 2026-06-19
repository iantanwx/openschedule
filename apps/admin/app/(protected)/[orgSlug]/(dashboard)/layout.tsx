import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
