"use client";

import { BookingBlock } from "./booking-block";

interface Booking {
  _id: string;
  therapistId: string;
  customerId: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
}

interface TimeGridProps {
  bookings: Booking[];
  dayStart: string; // "HH:MM"
  dayEnd: string; // "HH:MM"
  onBookingTap: (bookingId: string) => void;
}

function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

export function TimeGrid({ bookings, dayStart, dayEnd, onBookingTap }: TimeGridProps) {
  const startMinutes = timeToMinutes(dayStart);
  const endMinutes = timeToMinutes(dayEnd);
  const totalHours = (endMinutes - startMinutes) / 60;

  // Generate hour markers
  const hours: string[] = [];
  for (let i = 0; i <= totalHours; i++) {
    const min = startMinutes + i * 60;
    const h = Math.floor(min / 60);
    hours.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="relative" style={{ height: `${totalHours * 80}px` }}>
        {/* Hour markers */}
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute inset-x-0 flex items-start"
            style={{ top: `${(i / totalHours) * 100}%` }}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-xs text-muted-foreground">
              {hour}
            </span>
            <div className="flex-1 border-t border-dashed border-muted" />
          </div>
        ))}

        {/* Booking blocks */}
        {bookings
          .filter((b) => b.status !== "cancelled")
          .map((booking) => (
            <BookingBlock
              key={booking._id}
              booking={booking}
              dayStartMinutes={startMinutes}
              dayEndMinutes={endMinutes}
              onTap={onBookingTap}
            />
          ))}
      </div>
    </div>
  );
}
