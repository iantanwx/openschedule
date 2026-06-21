"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { getVisibleOrgLinks } from "@/lib/nav/org-links";

interface MobileOrgNavProps {
  className?: string;
}

export function MobileOrgNav({ className }: MobileOrgNavProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const links = getVisibleOrgLinks(isOwner);

  return (
    <nav
      className={`flex items-center gap-1 overflow-x-auto border-b px-4${className ? ` ${className}` : ""}`}
    >
      {links.map((link) => {
        const active = link.isActive(pathname, orgSlug);
        const Icon = link.icon;
        return (
          <Link
            key={link.label}
            href={link.href(orgSlug)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm ${
              active
                ? "border-b-2 border-foreground text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
