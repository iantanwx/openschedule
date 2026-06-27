"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@opencal/convex/api"
import { TherapistGrid } from "@/components/therapist-grid"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
  }
}
const orgGetBySlug = convexApi.queries.organizations.getBySlug
const venueGetBySlug = convexApi.queries.venues.getBySlug

interface TherapistGridPageProps {
  orgSlug: string
  venueSlug: string
}

export function TherapistGridPage({ orgSlug, venueSlug }: TherapistGridPageProps) {
  const org = useQuery(orgGetBySlug, { slug: orgSlug })
  const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  if (org === undefined || venue === undefined) {
    return null
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return <TherapistGrid venueId={venue._id} orgSlug={orgSlug} venueSlug={venueSlug} />
}
