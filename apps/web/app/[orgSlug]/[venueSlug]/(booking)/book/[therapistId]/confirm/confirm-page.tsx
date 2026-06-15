"use client"

import { useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { BookingForm } from "@/components/booking-form"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
  }
}
const orgGetBySlug = convexApi.queries.organizations.getBySlug
const venueGetBySlug = convexApi.queries.venues.getBySlug

interface ConfirmPageProps {
  orgSlug: string
  venueSlug: string
  therapistId: string
}

export function ConfirmPage({ orgSlug, venueSlug, therapistId }: ConfirmPageProps) {
  const searchParams = useSearchParams()
  const date = searchParams.get("date")
  const time = searchParams.get("time")

  const org = useQuery(orgGetBySlug, { slug: orgSlug }) as { _id: string } | null | undefined
  const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip") as { _id: string } | null | undefined

  if (!date || !time) {
    return <p className="text-destructive">Missing date or time. Please go back and select a time slot.</p>
  }

  if (org === undefined || venue === undefined) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return (
    <BookingForm
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      venueId={venue._id}
      orgId={org._id}
      therapistId={therapistId}
      date={date}
      time={time}
    />
  )
}
