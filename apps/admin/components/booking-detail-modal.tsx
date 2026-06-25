"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { capitalize } from "@openschedule/lib/strings";
import { RescheduleView } from "./reschedule-view";
import { useState } from "react";
import { Button } from "@openschedule/ui/components/button";
import { Badge } from "@openschedule/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openschedule/ui/components/dialog";

interface BookingData {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
  createdBy: string;
  therapistId: string;
  customerId: string;
  serviceId?: string;
}

interface BookingDetailModalProps {
  bookingId: string;
  venueId: string;
  readOnly?: boolean;
  customerName?: string;
  therapistName?: string;
  initialBooking?: BookingData;
  onClose: () => void;
}

const STATUS_BADGE_VARIANT = {
  confirmed: "default" as const,
  pending: "secondary" as const,
  cancelled: "outline" as const,
};

export function BookingDetailModal({ bookingId, venueId, readOnly = false, customerName, therapistName, initialBooking, onClose }: BookingDetailModalProps) {
  const [showReschedule, setShowReschedule] = useState(false);

  const fetchedBooking = useQuery(
    convexApi.queries.bookings.get,
    initialBooking ? "skip" : { id: bookingId },
  );
  const booking = initialBooking ?? fetchedBooking;

  const customer = useQuery(
    convexApi.queries.customers.get,
    booking && !customerName ? { id: booking.customerId } : "skip",
  );
  const therapist = useQuery(
    convexApi.queries.users.getPublic,
    booking && !therapistName ? { id: booking.therapistId } : "skip",
  );

  const resolvedCustomerName = customerName ?? customer?.name ?? "Loading...";
  const resolvedTherapistName = therapistName ?? therapist?.name ?? "Loading...";

  const confirmMutation = useMutation(convexApi.mutations.bookings.confirm);
  const cancelMutation = useMutation(convexApi.mutations.bookings.cancel);

  if (!booking) {
    return null;
  }

  async function handleConfirm() {
    await confirmMutation({ id: bookingId });
  }

  async function handleCancel() {
    await cancelMutation({ id: bookingId });
  }

  if (showReschedule) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <RescheduleView
            bookingId={bookingId}
            therapistId={booking.therapistId}
            venueId={venueId}
            serviceId={booking.serviceId ?? null}
            onDone={() => {
              setShowReschedule(false);
              onClose();
            }}
            onBack={() => setShowReschedule(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[booking.status]}>
              {capitalize(booking.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created by {booking.createdBy}
            </span>
          </div>

          {/* Time info */}
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Date:</span> {booking.date}
            </p>
            <p>
              <span className="text-muted-foreground">Time:</span>{" "}
              {booking.startTime} – {booking.endTime}
            </p>
            <p>
              <span className="text-muted-foreground">Therapist:</span>{" "}
              {resolvedTherapistName}
            </p>
          </div>

          {/* Customer info */}
          <div className="space-y-1 text-sm">
            <p className="font-medium">Customer</p>
            <p>{resolvedCustomerName}</p>
            {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          </div>

          {/* Actions — hidden in read-only mode */}
          {!readOnly && booking.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2 pt-2">
              {booking.status === "pending" && (
                <Button size="sm" onClick={handleConfirm}>
                  Confirm
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowReschedule(true)}>
                Reschedule
              </Button>
              <Button size="sm" variant="destructive" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
