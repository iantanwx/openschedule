import { Calendar, List, Clock, Settings } from "lucide-react";
import type { ComponentType } from "react";

export interface VenueTabLink {
  label: string;
  icon: ComponentType<{ className?: string }>;
  ownerOnly: boolean;
  /** Returns the href given the venue base path */
  href: (base: string) => string;
  /** Returns true if this tab is active */
  isActive: (pathname: string, base: string) => boolean;
}

export const VENUE_TAB_LINKS: VenueTabLink[] = [
  {
    label: "Today",
    icon: Calendar,
    ownerOnly: false,
    href: (base) => base,
    isActive: (pathname, base) => pathname === base || pathname === `${base}/`,
  },
  {
    label: "Bookings",
    icon: List,
    ownerOnly: false,
    href: (base) => `${base}/bookings`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/bookings`),
  },
  {
    label: "Schedule",
    icon: Clock,
    ownerOnly: false,
    href: (base) => `${base}/schedule`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/schedule`),
  },
  {
    label: "Settings",
    icon: Settings,
    ownerOnly: true,
    href: (base) => `${base}/settings`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/settings`),
  },
];

export function getVisibleVenueTabs(isOwner: boolean): VenueTabLink[] {
  return VENUE_TAB_LINKS.filter((tab) => !tab.ownerOnly || isOwner);
}
