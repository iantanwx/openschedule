import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { MobileTopBar } from "@/components/mobile-top-bar";

export default function OrgShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar className="hidden md:flex" />
        <MobileTopBar mode="org" className="md:hidden" />
        <main className="flex-1 min-h-0">{children}</main>
      </div>
    </div>
  );
}
