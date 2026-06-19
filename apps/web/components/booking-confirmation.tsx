"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic

interface BookingConfirmationProps {
  bookingId: string
}

export function BookingConfirmation({ bookingId }: BookingConfirmationProps) {
  const booking = useQuery(bookingsGet, { id: bookingId })

  if (booking === undefined) {
    return (
      <div className="mx-auto max-w-md animate-pulse space-y-4 py-12">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-40 rounded-lg bg-muted" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-muted-foreground">
          This booking may have been removed.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        {booking.status === "pending" && (
          <>
            <h1 className="text-2xl font-semibold">Booking requested</h1>
            <p className="mt-1 text-muted-foreground">
              Waiting for confirmation
            </p>
          </>
        )}
        {booking.status === "confirmed" && (
          <>
            <h1 className="text-2xl font-semibold">Booking confirmed</h1>
            <p className="mt-1 text-muted-foreground">You&apos;re all set</p>
          </>
        )}
        {booking.status === "cancelled" && (
          <>
            <h1 className="text-2xl font-semibold">Booking cancelled</h1>
            <p className="mt-1 text-muted-foreground">
              This booking has been cancelled
            </p>
          </>
        )}
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <StatusBadge status={booking.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Date</span>
          <span className="text-sm font-medium">
            {formatDate(booking.date)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Time</span>
          <span className="text-sm font-medium">
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
        <TherapistLine therapistId={booking.therapistId} />
      </Card>

      {booking.status !== "cancelled" && (
        <p className="text-center text-sm text-muted-foreground">
          Need to cancel? Use the link in your booking confirmation email.
        </p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "confirmed"
      ? "default"
      : status === "cancelled"
        ? "destructive"
        : "secondary"
  return <Badge variant={variant}>{status}</Badge>
}

function TherapistLine({ therapistId }: { therapistId: string }) {
  const user = useQuery(usersGetPublic, { id: therapistId })
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Therapist</span>
      <span className="text-sm font-medium">{user?.name ?? "..."}</span>
    </div>
  )
}

function formatDate(date: string): string {
  const parts = date.split("-")
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  })
}

function formatTime(time: string): string {
  const parts = time.split(":")
  const h = Number(parts[0])
  const minutes = parts[1] ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
