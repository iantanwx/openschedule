"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@opencal/convex/api"
import { VenueDirectoryCard } from "./venue-directory-card"
import { Skeleton } from "@opencal/ui/components/skeleton"

const convexApi = api as unknown as {
  queries: {
    directory: {
      listPublicDirectory: FunctionReference<"query">
    }
  }
}

interface DirectoryVenue {
  _id: string
  name: string
  slug: string
  address?: string
  description?: string
  coverImageUrl?: string | null
  org: {
    _id: string
    name: string
    slug: string
    description?: string
  }
}

export function BusinessCarousel() {
  const venues: DirectoryVenue[] | undefined = useQuery(
    convexApi.queries.directory.listPublicDirectory,
    {},
  )

  if (venues === undefined) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Browse businesses</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] rounded-lg" />
          ))}
        </div>
      </section>
    )
  }

  if (venues.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Browse businesses</h2>
        <p className="text-sm text-muted-foreground">
          No businesses registered yet.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Browse businesses</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <VenueDirectoryCard key={venue._id} venue={venue} />
        ))}
      </div>
    </section>
  )
}
