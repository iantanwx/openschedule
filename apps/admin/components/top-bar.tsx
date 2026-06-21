"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization, useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { ArrowLeft, ChevronDown, Settings, LogOut } from "lucide-react";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
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
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const venueName = venue?.name ?? venueSlug;
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasMultipleVenues = venues && venues.length > 1;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  function handleVenueSwitch(targetSlug: string) {
    router.push(`/${orgSlug}/venues/${targetSlug}`);
  }

  return (
    <header className={`flex h-14 items-center justify-between border-b px-4 ${className ?? ""}`}>
      {/* Left: back arrow + org logo + venue switcher */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${orgSlug}`}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Back to organization"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold">
          {orgName.charAt(0).toUpperCase()}
        </div>
        <div className="flex items-center gap-1">
          {hasMultipleVenues ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80">
                {venueName}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {venues.map((v) => (
                  <DropdownMenuItem
                    key={v._id}
                    onClick={() => handleVenueSwitch(v.slug)}
                    className={v.slug === venueSlug ? "font-semibold" : ""}
                  >
                    {v.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm font-medium">{venueName}</span>
          )}
        </div>
      </div>

      {/* Right: avatar dropdown */}
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
