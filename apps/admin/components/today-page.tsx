"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive date from URL search param, default to today
  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ?? format(new Date(), "yyyy-MM-dd");

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

  const isTherapist = currentUser?.roles.includes("therapist") ?? false;
  const isOwner = currentUser?.roles.includes("owner") ?? false;

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

  // Scroll to top when date resets (navigating to base without ?date)
  useEffect(() => {
    if (!dateParam) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [dateParam]);

  const handlePrev = useCallback(() => {
    const newDate = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    router.replace(`${pathname}?date=${newDate}`, { scroll: false });
  }, [selectedDate, router, pathname]);

  const handleNext = useCallback(() => {
    const newDate = format(addDays(selectedDate, 1), "yyyy-MM-dd");
    router.replace(`${pathname}?date=${newDate}`, { scroll: false });
  }, [selectedDate, router, pathname]);

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
