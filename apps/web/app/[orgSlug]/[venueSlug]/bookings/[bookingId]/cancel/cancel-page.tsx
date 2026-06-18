"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Button } from "@openschedule/ui/components/button"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
  mutations: {
    bookings: { cancelWithToken: FunctionReference<"mutation"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic
const bookingsCancelWithToken = convexApi.mutations.bookings.cancelWithToken

interface CancelPageProps {
  orgSlug: string
  venueSlug: string
  bookingId: string
}

export function CancelPage({ orgSlug, venueSlug, bookingId }: CancelPageProps) {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const booking = useQuery(bookingsGet, { id: bookingId })
  const cancelBooking = useMutation(bookingsCancelWithToken)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const venueHref = `/${orgSlug}/${venueSlug}`

  // No token in the URL → the link is invalid; never call the mutation.
  if (!token) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Invalid cancel link</h1>
        <p className="mt-2 text-muted-foreground">
          This cancel link is invalid. Use the link from your booking email.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  if (booking === undefined) {
    return <Skeleton className="mx-auto mt-12 h-96 w-full max-w-md" />
  }

  if (!booking) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t find this booking.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  // Already-cancelled (either in the fetched status or after a successful click)
  if (booking.status === "cancelled" || cancelled) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Booking cancelled</h1>
        <p className="mt-2 text-muted-foreground">
          This booking has already been cancelled.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  async function handleCancel() {
    setIsCancelling(true)
    setError(null)
    try {
      await cancelBooking({ id: bookingId, cancelToken: token })
      setCancelled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsCancelling(false)
    }
  }

  const isInvalidTokenError =
    error !== null && error.includes("Invalid or missing cancel token")

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Cancel this booking?</h1>
        <p className="mt-1 text-muted-foreground">
          This action cannot be undone.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Date</span>
          <span className="text-sm font-medium">{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Time</span>
          <span className="text-sm font-medium">
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
        <TherapistLine therapistId={booking.therapistId} />
      </Card>

      {isInvalidTokenError ? (
        <p className="text-center text-sm text-destructive">
          This cancel link is invalid. Use the link from your booking email.
        </p>
      ) : error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : null}

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleCancel}
        disabled={isCancelling}
      >
        {isCancelling ? "Cancelling..." : "Cancel booking"}
      </Button>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-12 text-center">{children}</div>
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="mt-6 inline-block text-sm underline">
      Back to venue
    </Link>
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
