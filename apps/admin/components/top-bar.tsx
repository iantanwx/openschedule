"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
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
import { ChevronsUpDown, Check, Settings, LogOut } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@openschedule/ui/lib/utils";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const currentVenue = venues?.find((v) => v.slug === venueSlug);
  const label = currentVenue?.name ?? "All Venues";

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

  function handleVenueSwitch(slug: string) {
    router.push(`/${orgSlug}/venues/${slug}`);
  }

  function handleAllVenues() {
    router.push(`/${orgSlug}`);
  }

  return (
    <header className={cn("flex h-14 items-center justify-between border-b px-4", className)}>
      {/* Left: venue switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {label}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            onClick={handleAllVenues}
            className="flex items-center justify-between"
          >
            <span>All Venues</span>
            {!venueSlug && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(venues ?? []).map((venue) => (
            <DropdownMenuItem
              key={venue._id}
              onClick={() => handleVenueSwitch(venue.slug)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{venue.name}</span>
              {venue.slug === venueSlug && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="User menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
              <a href="/account" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Account Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
