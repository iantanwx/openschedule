import { TopBar } from "@/components/top-bar";
import { TabBar } from "@/components/tab-bar";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1 pb-16">{children}</main>
      <TabBar />
    </div>
  );
}
