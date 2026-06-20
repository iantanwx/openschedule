"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization } from "@/lib/auth-client";
import { useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { VenueSwitcher } from "./venue-switcher";
import { ChevronRight, Settings, LogOut } from "lucide-react";

export function TopBar() {
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
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

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-1.5">
        {orgSlug ? (
          <Link href={`/${orgSlug}`} className="text-sm font-semibold hover:text-foreground/80">
            {orgName}
          </Link>
        ) : (
          <span className="text-sm font-semibold">{orgName}</span>
        )}
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
