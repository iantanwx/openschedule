"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { format, addDays, subDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { TimeGrid } from "./time-grid";
import { DayNav } from "./day-nav";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { Badge } from "@openschedule/ui/components/badge";

interface TodayPageProps {
  orgSlug: string;
}

export function TodayPage({ orgSlug }: TodayPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    venue ? { venueId: venue._id, date: selectedDate } : "skip",
  );

  const handlePrev = useCallback(() => {
    setSelectedDate((d) => format(subDays(d, 1), "yyyy-MM-dd"));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedDate((d) => format(addDays(d, 1), "yyyy-MM-dd"));
  }, []);

  if (org === undefined || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No venue configured yet.</p>
          <p className="text-muted-foreground text-sm">Go to Settings to create your first venue.</p>
        </div>
      </div>
    );
  }

  const activeBookings = bookings?.filter((b) => b.status !== "cancelled") ?? [];
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="flex h-full flex-col">
      {/* Day nav */}
      <DayNav date={selectedDate} onPrev={handlePrev} onNext={handleNext} />

      {/* Stats banner */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <Badge variant="secondary">{activeBookings.length} bookings</Badge>
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
          {confirmedCount} confirmed
        </Badge>
        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
          {pendingCount} pending
        </Badge>
      </div>

      {/* Time grid */}
      <TimeGrid
        bookings={bookings ?? []}
        dayStart={venue.dayStart}
        dayEnd={venue.dayEnd}
        onBookingTap={setSelectedBookingId}
      />

      {/* FAB */}
      <Fab orgSlug={orgSlug} venueId={venue._id} />

      {/* Booking detail modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
