"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { format, addDays, subDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { TimeGrid } from "./time-grid";
import { DayNav } from "./day-nav";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";
import { Badge } from "@openschedule/ui/components/badge";

interface TodayPageProps {
  orgSlug: string;
  venueSlug: string;
}

export function TodayPage({ orgSlug, venueSlug }: TodayPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    venue ? { venueId: venue._id, date: selectedDate } : "skip",
  );

  const isTherapist = currentUser?.role === "therapist";
  const isOwner = currentUser?.role === "owner";

  // For therapists in "my" view, filter to only their bookings
  const displayedBookings = useMemo(() => {
    if (!bookings) return [];
    if (isOwner || (isTherapist && viewScope === "all")) {
      return bookings;
    }
    // Therapist "my" view
    if (isTherapist && currentUser) {
      return bookings.filter((b) => b.therapistId === currentUser._id);
    }
    return bookings;
  }, [bookings, isOwner, isTherapist, viewScope, currentUser]);

  // Read-only mode: therapist viewing "all"
  const isReadOnly = isTherapist && viewScope === "all";

  const handlePrev = useCallback(() => {
    setSelectedDate((d) => format(subDays(d, 1), "yyyy-MM-dd"));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedDate((d) => format(addDays(d, 1), "yyyy-MM-dd"));
  }, []);

  if (org === undefined || venue === undefined) {
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
        <p className="text-muted-foreground">Venue not found.</p>
      </div>
    );
  }

  const activeBookings = displayedBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="flex h-full flex-col">
      {/* Day nav */}
      <DayNav date={selectedDate} onPrev={handlePrev} onNext={handleNext} />

      {/* View toggle + stats banner */}
      <div className="flex items-center gap-2 px-4 pb-2">
        {isTherapist && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}
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
        bookings={displayedBookings}
        dayStart={venue.dayStart}
        dayEnd={venue.dayEnd}
        onBookingTap={setSelectedBookingId}
      />

      {/* FAB */}
      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

      {/* Booking detail modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          readOnly={isReadOnly}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
