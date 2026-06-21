"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b || pathname === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];
}

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  function handleTodayClick(e: React.MouseEvent, tab: Tab) {
    if (tab.label === "Today" && tab.match(pathname, base)) {
      e.preventDefault();
      // Already on Today — navigate to base (no ?date), triggering scroll-to-top + reset
      router.push(base);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background ${className ?? ""}`}>
      <ul className="flex h-16 items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                onClick={(e) => handleTodayClick(e, tab)}
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
