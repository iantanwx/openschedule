"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
    },
  ];
}

export function TabBar() {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background">
      <ul className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
