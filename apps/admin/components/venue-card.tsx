"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";

interface VenueCardProps {
  venue: {
    _id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  orgSlug: string;
}

export function VenueCard({ venue, orgSlug }: VenueCardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    { venueId: venue._id, date: today },
  );

  const pending = bookings?.filter((b) => b.status === "pending").length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === "confirmed").length ?? 0;

  return (
    <Link href={`/${orgSlug}/venues/${venue.slug}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{venue.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{venue.timezone}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              {confirmed} confirmed
            </Badge>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {pending} pending
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
