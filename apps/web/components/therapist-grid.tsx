"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { TherapistCard } from "./therapist-card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    users: { listByVenue: FunctionReference<"query"> }
  }
}
const usersListByVenue = convexApi.queries.users.listByVenue

interface TherapistGridProps {
  venueId: string
  orgSlug: string
  venueSlug: string
}

export function TherapistGrid({ venueId, orgSlug, venueSlug }: TherapistGridProps) {
  const therapists = useQuery(usersListByVenue, { venueId })

  if (therapists === undefined) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a therapist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a therapist or let us pick one for you
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(therapists as Array<{ _id: string; name: string }>).map((therapist) => (
          <TherapistCard
            key={therapist._id}
            id={therapist._id}
            name={therapist.name}
            orgSlug={orgSlug}
            venueSlug={venueSlug}
          />
        ))}
        <TherapistCard
          id="any"
          name="Any available"
          orgSlug={orgSlug}
          venueSlug={venueSlug}
          isWildcard
        />
      </div>
    </div>
  )
}
