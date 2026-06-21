import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex-1 pb-16 md:pb-0">{children}</div>
      <TabBar className="md:hidden" />
    </>
  );
}
