"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import { VenueSwitcher } from "./venue-switcher";
import { ChevronRight } from "lucide-react";

export function TopBar() {
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-1.5">
        <Link href={`/${orgSlug}`} className="text-sm font-semibold hover:text-foreground/80">
          {orgName}
        </Link>
        {venue && venueSlug && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <VenueSwitcher
              orgId={org?._id ?? ""}
              orgSlug={orgSlug}
              currentVenueName={venue.name}
            />
          </>
        )}
      </div>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </header>
  );
}
