"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { useState } from "react";
import { CreateVenueDialog } from "./create-venue-dialog";

interface VenueSwitcherBarProps {
  className?: string;
}

export function VenueSwitcherBar({ className }: VenueSwitcherBarProps) {
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const currentVenue = venues?.find((v) => v.slug === venueSlug);
  const label = currentVenue?.name ?? "All Venues";

  function handleSwitch(slug: string) {
    router.push(`/${orgSlug}/venues/${slug}`);
  }

  function handleAllVenues() {
    router.push(`/${orgSlug}`);
  }

  return (
    <>
      <div className={className}>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                onClick={() => handleSwitch(venue.slug)}
                className="flex items-center justify-between"
              >
                <span className="truncate">{venue.name}</span>
                {venue.slug === venueSlug && <Check className="h-4 w-4 shrink-0" />}
              </DropdownMenuItem>
            ))}
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowCreateDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Venue
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showCreateDialog && org && (
        <CreateVenueDialog orgId={org._id} onClose={() => setShowCreateDialog(false)} />
      )}
    </>
  );
}
