"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Users, Settings } from "lucide-react";

export function OrgNav() {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;

  if (!isOwner) return null;

  const links = [
    { label: "Team", href: `/${orgSlug}/team`, icon: Users },
    { label: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <nav className="flex items-center gap-4 border-b px-4 py-2">
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
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
