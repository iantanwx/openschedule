"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Calendar } from "@openschedule/ui/components/calendar";

interface RescheduleViewProps {
  bookingId: string;
  therapistId: string;
  venueId: string;
  onDone: () => void;
  onBack: () => void;
}

export function RescheduleView({
  bookingId,
  therapistId,
  venueId,
  onDone,
  onBack,
}: RescheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = useQuery(convexApi.queries.availability.getSlots, {
    venueId,
    therapistId,
  });

  const rescheduleMutation = useMutation(
    convexApi.mutations.bookings.reschedule,
  );

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const availableSlotsForDate =
    dateStr && slots ? (slots[dateStr] ?? []) : [];

  // Determine which dates have available slots
  const availableDates = new Set(
    slots
      ? Object.keys(slots).filter((d) => {
          const daySlots = slots[d];
          return daySlots && daySlots.length > 0;
        })
      : [],
  );

  async function handleConfirm() {
    if (!dateStr || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      await rescheduleMutation({
        id: bookingId,
        newDate: dateStr,
        newStartTime: selectedSlot.startTime,
        newEndTime: selectedSlot.endTime,
      });
      onDone();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div>
        <p className="mb-2 text-sm font-medium">Pick a new date</p>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            setSelectedSlot(null);
          }}
          disabled={(date) => {
            const d = format(date, "yyyy-MM-dd");
            return !availableDates.has(d);
          }}
          className="rounded-md border"
        />
      </div>

      {/* Time slots */}
      {dateStr && (
        <div>
          <p className="mb-2 text-sm font-medium">Available times</p>
          {availableSlotsForDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No slots available on this date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlotsForDate.map((slot) => (
                <Button
                  key={slot.startTime}
                  variant={
                    selectedSlot?.startTime === slot.startTime
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot.startTime}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={!selectedSlot || isSubmitting}
          onClick={handleConfirm}
        >
          {isSubmitting ? "Saving..." : "Confirm Reschedule"}
        </Button>
      </div>
    </div>
  );
}
