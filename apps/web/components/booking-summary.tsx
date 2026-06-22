"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { useParams, useSearchParams } from "next/navigation"
import { api } from "@openschedule/convex/api"
import { Skeleton } from "@openschedule/ui/components/skeleton"
import { VenueMap } from "./venue-map"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
// Cast through unknown to a concrete shape matching the actual generated API
const convexApi = api as unknown as {
  queries: {
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
  }
}
const orgGetBySlug = convexApi.queries.organizations.getBySlug
const venueGetBySlug = convexApi.queries.venues.getBySlug

interface BookingSummaryProps {
  orgSlug: string
  venueSlug: string
}

export function BookingSummary({ orgSlug, venueSlug }: BookingSummaryProps) {
  const params = useParams<{ therapistId?: string }>()
  const searchParams = useSearchParams()

  const date = searchParams.get("date")
  const time = searchParams.get("time")
  const therapistId = params.therapistId

  const org = useQuery(orgGetBySlug, { slug: orgSlug })
  const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  if (org === undefined || venue === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
    )
  }

  if (!org || !venue) {
    return <p className="text-sm text-muted-foreground">Venue not found</p>
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{venue.name}</h2>
      <p className="text-sm text-muted-foreground">{org.name}</p>

      {therapistId && therapistId !== "any" && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm">Therapist selected</p>
        </div>
      )}
      {therapistId === "any" && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm">Any available therapist</p>
        </div>
      )}

      {date && (
        <div className="mt-2">
          <p className="text-sm font-medium">{formatDate(date)}</p>
          {time && <p className="text-sm text-muted-foreground">{formatTime(time)}</p>}
        </div>
      )}

      {venue.address && venue.coordinates && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
          <VenueMap
            address={venue.address}
            coordinates={venue.coordinates as { lat: number; lng: number }}
            placeId={(venue as any).placeId}
            venueName={venue.name}
            height={120}
          />
        </div>
      )}
    </div>
  )
}

function formatDate(date: string): string {
  const parts = date.split("-")
  const year = Number(parts[0])
  const month = Number(parts[1]) - 1
  const day = Number(parts[2])
  const d = new Date(year, month, day)
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string): string {
  const parts = time.split(":")
  const h = Number(parts[0])
  const minutes = parts[1]
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
