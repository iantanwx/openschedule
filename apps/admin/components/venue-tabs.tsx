"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { getVisibleVenueTabs } from "@/lib/nav/venue-tabs";

interface VenueTabsProps {
  className?: string;
}

export function VenueTabs({ className }: VenueTabsProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = getVisibleVenueTabs(isOwner);

  return (
    <nav className={`border-b px-4${className ? ` ${className}` : ""}`}>
      <ul className="flex items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname, base);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href(base)}
                className={`inline-block px-3 py-2.5 text-sm ${
                  active
                    ? "border-b-2 border-foreground text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
