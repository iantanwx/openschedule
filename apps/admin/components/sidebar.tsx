"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { User } from "lucide-react";
import { cn } from "@openschedule/ui/lib/utils";
import { convexApi } from "@/lib/convex-api";
import { useActiveOrganization } from "@/lib/auth-client";
import { getVisibleOrgLinks } from "@/lib/nav/org-links";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug ?? "";

  const { data: activeOrg } = useActiveOrganization();
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const visibleLinks = getVisibleOrgLinks(isOwner);

  const orgName = activeOrg?.name ?? "Org";
  const orgInitial = orgName.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "flex w-[200px] flex-col border-r bg-muted/50",
        className,
      )}
    >
      {/* Org identity */}
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
          {orgInitial}
        </span>
        <span className="truncate text-sm font-medium">{orgName}</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const active = link.isActive(pathname, orgSlug);
          return (
            <Link
              key={link.label}
              href={link.href(orgSlug)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t px-2 py-2">
        <Link
          href="/account"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            pathname.startsWith("/account")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <User className="h-4 w-4" />
          Account
        </Link>
      </div>
    </aside>
  );
}
