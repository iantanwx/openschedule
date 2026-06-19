"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { VenueCard } from "./venue-card";
import { CreateVenueCard } from "./create-venue-card";
import { TimeGrid } from "./time-grid";
import { BookingDetailModal } from "./booking-detail-modal";
import { Badge } from "@openschedule/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface OrgDashboardPageProps {
  orgSlug: string;
}

export function OrgDashboardPage({ orgSlug }: OrgDashboardPageProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>("all");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const today = format(new Date(), "yyyy-MM-dd");

  // Fetch bookings for all venues today
  const firstVenue = venues?.[0] ?? null;
  const secondVenue = venues?.[1] ?? null;
  const thirdVenue = venues?.[2] ?? null;

  const bookingsFirst = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    firstVenue ? { venueId: firstVenue._id, date: today } : "skip",
  );
  const bookingsSecond = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    secondVenue ? { venueId: secondVenue._id, date: today } : "skip",
  );
  const bookingsThird = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    thirdVenue ? { venueId: thirdVenue._id, date: today } : "skip",
  );

  const allBookings = useMemo(() => {
    const combined = [
      ...(bookingsFirst ?? []),
      ...(bookingsSecond ?? []),
      ...(bookingsThird ?? []),
    ];
    if (venueFilter === "all") return combined;
    return combined.filter((b) => b.venueId === venueFilter);
  }, [bookingsFirst, bookingsSecond, bookingsThird, venueFilter]);

  const isOwner = currentUser?.roles.includes("owner") ?? false;

  if (!org || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div className="space-y-6 p-4">
        <h2 className="text-lg font-semibold">Welcome to {org.name}</h2>
        <p className="text-muted-foreground">Create your first venue to get started.</p>
        {isOwner && <CreateVenueCard orgId={org._id} />}
      </div>
    );
  }

  // Use the first venue's hours for the aggregated grid (best-effort)
  const gridVenue = firstVenue;
  const activeBookings = allBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="space-y-6 p-4">
      {/* Venue cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Venues</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue._id} venue={venue} orgSlug={orgSlug} />
          ))}
          {isOwner && <CreateVenueCard orgId={org._id} />}
        </div>
      </div>

      {/* Aggregated today */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Today</h2>
          {venues.length > 1 && (
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="secondary">{activeBookings.length} bookings</Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {confirmedCount} confirmed
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {pendingCount} pending
          </Badge>
        </div>

        {gridVenue && (
          <TimeGrid
            bookings={allBookings}
            dayStart={gridVenue.dayStart}
            dayEnd={gridVenue.dayEnd}
            onBookingTap={setSelectedBookingId}
          />
        )}
      </div>

      {selectedBookingId && firstVenue && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={firstVenue._id}
          readOnly={false}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
