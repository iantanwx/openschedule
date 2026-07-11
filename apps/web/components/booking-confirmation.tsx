"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import type { FunctionReference } from "convex/server"
import { api } from "@opencal/convex/api"
import { StatusBadge } from "@opencal/ui/components/status-badge"
import { Button } from "@opencal/ui/components/button"
import { Card } from "@opencal/ui/components/card"
import { ArrowLeft } from "lucide-react"
import { VenueMap } from "./venue-map"
import { PaymentInfo } from "./payment-info"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
    paymentMethods: { getForVenue: FunctionReference<"query"> }
    payments: { getForBooking: FunctionReference<"query"> }
    services: { get: FunctionReference<"query"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic
const orgGetBySlug = convexApi.queries.organizations.getBySlug
const venueGetBySlug = convexApi.queries.venues.getBySlug
const paymentMethodsGetForVenue = convexApi.queries.paymentMethods.getForVenue
const paymentsGetForBooking = convexApi.queries.payments.getForBooking
const servicesGet = convexApi.queries.services.get

interface BookingConfirmationProps {
  bookingId: string
  orgSlug: string
  venueSlug: string
}

export function BookingConfirmation({ bookingId, orgSlug, venueSlug }: BookingConfirmationProps) {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const booking = useQuery(bookingsGet, { id: bookingId })
  const org = useQuery(orgGetBySlug, { slug: orgSlug })
  const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")
  const paymentMethod = useQuery(
    paymentMethodsGetForVenue,
    venue ? { venueId: venue._id } : "skip",
  )
  const payment = useQuery(
    paymentsGetForBooking,
    booking ? { bookingId: booking._id } : "skip",
  )
  const service = useQuery(
    servicesGet,
    booking?.serviceId ? { id: booking.serviceId } : "skip",
  )

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

      {paymentMethod && !payment && booking.status !== "cancelled" && (
        <PaymentInfo
          type={paymentMethod.type}
          label={paymentMethod.label}
          details={paymentMethod.details}
          imageUrl={paymentMethod.imageUrl}
          amount={service?.price}
          logoUrl={paymentMethod.logoUrl}
        />
      )}

      {booking.status !== "cancelled" && token && (
        <div className="text-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${orgSlug}/${venueSlug}/bookings/${bookingId}/cancel?token=${token}`}>
              Cancel booking
            </Link>
          </Button>
        </div>
      )}
      {booking.status !== "cancelled" && !token && (
        <p className="text-center text-sm text-muted-foreground">
          Need to cancel? Use the link in your booking confirmation email.
        </p>
      )}

      {venue && (venue as any).address && (venue as any).coordinates && (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <VenueMap
            address={(venue as any).address}
            coordinates={(venue as any).coordinates as { lat: number; lng: number }}
            placeId={(venue as any).placeId}
            venueName={(venue as any).name ?? ""}
            height={160}
            showLink
          />
        </div>
      )}

      <div className="text-center">
        <Link
          href={`/${orgSlug}/${venueSlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {org?.name ?? "booking"}
        </Link>
      </div>
    </div>
  )
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
