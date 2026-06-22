import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <TabBar className="md:hidden" />
    </div>
  );
}
