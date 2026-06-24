"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";

interface BookingBlockProps {
  booking: {
    _id: string;
    therapistId: string;
    customerId: string;
    startTime: string;
    endTime: string;
    status: "pending" | "confirmed" | "cancelled";
  };
  dayStartMinutes: number;
  dayEndMinutes: number;
  onTap: (bookingId: string) => void;
}

function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

const STATUS_STYLES = {
  confirmed: "bg-emerald-100 border-emerald-300 border text-emerald-950 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100",
  pending: "bg-amber-100 border-amber-300 border text-amber-950 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
  cancelled: "bg-gray-100 border-gray-300 border opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300",
} as const;

export function BookingBlock({ booking, dayStartMinutes, dayEndMinutes, onTap }: BookingBlockProps) {
  const customer = useQuery(convexApi.queries.customers.get, { id: booking.customerId });
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: booking.therapistId });

  const startMin = timeToMinutes(booking.startTime);
  const endMin = timeToMinutes(booking.endTime);
  const totalMinutes = dayEndMinutes - dayStartMinutes;

  const topPercent = ((startMin - dayStartMinutes) / totalMinutes) * 100;
  const heightPercent = ((endMin - startMin) / totalMinutes) * 100;

  return (
    <button
      type="button"
      className={`absolute inset-x-12 rounded-md px-2 py-1 text-left text-xs ${STATUS_STYLES[booking.status]}`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        minHeight: "24px",
      }}
      onClick={() => onTap(booking._id)}
      aria-label={`Booking ${booking.startTime}–${booking.endTime} ${customer?.name ?? ""}`}
    >
      <div className="truncate font-medium">
        {booking.startTime}–{booking.endTime}
      </div>
      <div className="truncate opacity-75">
        {customer?.name ?? "Loading..."}
      </div>
      {therapist && (
        <div className="truncate opacity-75">
          {therapist.name}
        </div>
      )}
    </button>
  );
}
