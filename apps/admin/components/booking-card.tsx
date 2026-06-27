"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { StatusBadge } from "@opencal/ui/components/status-badge";
import { Card, CardContent } from "@opencal/ui/components/card";

interface BookingCardProps {
  booking: {
    _id: string;
    therapistId: string;
    customerId: string;
    serviceId?: string;
    date: string;
    startTime: string;
    endTime: string;
    status: "pending" | "confirmed" | "cancelled";
  };
  onTap: (bookingId: string) => void;
}

export function BookingCard({ booking, onTap }: BookingCardProps) {
  const customer = useQuery(convexApi.queries.customers.get, { id: booking.customerId });
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: booking.therapistId });
  const service = useQuery(
    convexApi.queries.services.get,
    booking.serviceId ? { id: booking.serviceId } : "skip",
  );

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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {therapist && <span>{therapist.name}</span>}
            {therapist && service && <span>·</span>}
            {service && <span>{service.name}</span>}
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </CardContent>
    </Card>
  );
}
