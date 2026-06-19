"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useParams } from "next/navigation";
import { convexApi } from "@/lib/convex-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface VenueSwitcherProps {
  orgId: string;
  orgSlug: string;
  currentVenueName: string;
}

export function VenueSwitcher({ orgId, orgSlug, currentVenueName }: VenueSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ venueSlug: string }>();
  const currentVenueSlug = params.venueSlug;

  const venues = useQuery(convexApi.queries.venues.listByOrg, { orgId });

  if (!venues || venues.length <= 1) {
    return <span className="text-sm font-medium">{currentVenueName}</span>;
  }

  function handleSwitch(targetSlug: string) {
    const newPath = pathname.replace(
      `/${orgSlug}/venues/${currentVenueSlug}`,
      `/${orgSlug}/venues/${targetSlug}`,
    );
    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80">
        {currentVenueName}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {venues.map((venue) => (
          <DropdownMenuItem
            key={venue._id}
            onClick={() => handleSwitch(venue.slug)}
            className={venue.slug === currentVenueSlug ? "font-semibold" : ""}
          >
            {venue.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
