import { Home, Users, Layers, Settings } from "lucide-react";
import type { ComponentType } from "react";

export interface OrgNavLink {
  label: string;
  icon: ComponentType<{ className?: string }>;
  ownerOnly: boolean;
  /** Returns the href given an orgSlug */
  href: (orgSlug: string) => string;
  /** Returns true if this link is active given the current pathname */
  isActive: (pathname: string, orgSlug: string) => boolean;
}

export const ORG_NAV_LINKS: OrgNavLink[] = [
  {
    label: "Overview",
    icon: Home,
    ownerOnly: false,
    href: (orgSlug) => `/${orgSlug}`,
    isActive: (pathname, orgSlug) =>
      pathname === `/${orgSlug}` || pathname === `/${orgSlug}/`,
  },
  {
    label: "Team",
    icon: Users,
    ownerOnly: true,
    href: (orgSlug) => `/${orgSlug}/team`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/${orgSlug}/team`),
  },
  {
    label: "Services",
    icon: Layers,
    ownerOnly: true,
    href: (orgSlug) => `/${orgSlug}/services`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/${orgSlug}/services`),
  },
  {
    label: "Settings",
    icon: Settings,
    ownerOnly: true,
    href: (orgSlug) => `/${orgSlug}/settings`,
    isActive: (pathname, orgSlug) => pathname.startsWith(`/${orgSlug}/settings`),
  },
];

export function getVisibleOrgLinks(isOwner: boolean): OrgNavLink[] {
  return ORG_NAV_LINKS.filter((link) => !link.ownerOnly || isOwner);
}
