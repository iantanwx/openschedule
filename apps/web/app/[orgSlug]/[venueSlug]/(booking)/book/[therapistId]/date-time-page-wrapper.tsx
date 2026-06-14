"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { DateTimePage } from "./date-time-page"
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

interface Props {
  orgSlug: string
  venueSlug: string
  therapistId: string
}

export function DateTimePageWrapper({ orgSlug, venueSlug, therapistId }: Props) {
  const org = useQuery(orgGetBySlug, { slug: orgSlug }) as
    | { _id: string; name: string }
    | null
    | undefined
  const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip") as
    | { _id: string; name: string }
    | null
    | undefined

  if (org === undefined || venue === undefined) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return (
    <DateTimePage
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      therapistId={therapistId}
      venueId={venue._id}
    />
  )
}
