"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface VenueTabsProps {
  className?: string;
}

interface TabLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

export function VenueTabs({ className }: VenueTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const tabs: TabLink[] = [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (p, b) => p === b || p === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (p, b) => p.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (p, b) => p.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (p, b) => p.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  function handleTodayClick(e: React.MouseEvent, tab: TabLink) {
    if (tab.label === "Today" && tab.match(pathname, base)) {
      e.preventDefault();
      router.push(base);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className={`border-b px-4 ${className ?? ""}`}>
      <ul className="flex items-center gap-1">
        {visibleTabs.map((tab) => {
          const active = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                onClick={(e) => handleTodayClick(e, tab)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
