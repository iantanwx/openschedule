"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format, addDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { useViewScope } from "@/lib/hooks/use-view-scope";
import { FilterBar } from "./filter-bar";
import { BookingCard } from "./booking-card";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";
import { Spinner } from "@opencal/ui/components/spinner";

interface BookingsPageProps {
  orgSlug: string;
  venueSlug: string;
}

type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

export function BookingsPage({ orgSlug, venueSlug }: BookingsPageProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [therapistFilter, setTherapistFilter] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  // Default range: today + 7 days
  const today = format(new Date(), "yyyy-MM-dd");
  const endDate = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueDateRange,
    venue ? { venueId: venue._id, startDate: today, endDate } : "skip",
  );

  const { viewScope, setViewScope, showToggle, showTherapistFilter, isReadOnly, filteredByScope } =
    useViewScope({ currentUser, bookings });

  // Additional client-side filtering (status + therapist dropdown)
  const filteredBookings = useMemo(() => {
    return filteredByScope
      .filter((b) => {
        if (statusFilter !== "all" && b.status !== statusFilter) return false;
        if (therapistFilter && b.therapistId !== therapistFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.date as string;
        const dateB = b.date as string;
        const startA = a.startTime as string;
        const startB = b.startTime as string;
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return startB.localeCompare(startA);
      });
  }, [filteredByScope, statusFilter, therapistFilter]);

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-2">
        {showToggle && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}
      </div>

      <FilterBar
        status={statusFilter}
        onStatusChange={setStatusFilter}
        therapistId={therapistFilter}
        onTherapistChange={setTherapistFilter}
        therapists={therapists ?? []}
        showTherapistFilter={showTherapistFilter}
      />

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pt-2 pb-4">
        {filteredBookings.length === 0 ? (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            No bookings match your filters.
          </p>
        ) : (
          filteredBookings.map((booking) => (
            <BookingCard
              key={booking._id as string}
              booking={booking as any}
              onTap={setSelectedBookingId}
            />
          ))
        )}
      </div>

      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

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
