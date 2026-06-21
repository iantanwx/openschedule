"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Badge } from "@openschedule/ui/components/badge";
import { Card, CardContent } from "@openschedule/ui/components/card";

interface BookingCardProps {
  booking: {
    _id: string;
    therapistId: string;
    customerId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: "pending" | "confirmed" | "cancelled";
  };
  onTap: (bookingId: string) => void;
}

const STATUS_COLORS = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-gray-50 text-gray-500",
} as const;

export function BookingCard({ booking, onTap }: BookingCardProps) {
  const customer = useQuery(convexApi.queries.customers.get, { id: booking.customerId });
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: booking.therapistId });

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-foreground/30"
      onClick={() => onTap(booking._id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(booking._id);
        }
      }}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {booking.date} · {booking.startTime}–{booking.endTime}
          </p>
          <p className="text-sm">{customer?.name ?? "Loading..."}</p>
          {therapist && (
            <p className="text-xs text-muted-foreground">{therapist.name}</p>
          )}
        </div>
        <Badge className={STATUS_COLORS[booking.status]} variant="secondary">
          {booking.status}
        </Badge>
      </CardContent>
    </Card>
  );
}
