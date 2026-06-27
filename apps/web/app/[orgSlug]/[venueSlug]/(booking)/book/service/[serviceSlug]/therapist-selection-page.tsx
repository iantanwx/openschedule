"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@opencal/convex/api"
import { TherapistCard } from "@/components/therapist-card"
import { Skeleton } from "@opencal/ui/components/skeleton"

const convexApi = api as unknown as {
  queries: {
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
    services: { getBySlug: FunctionReference<"query"> }
    therapistServices: { listTherapistsByService: FunctionReference<"query"> }
  }
}

interface Props {
  orgSlug: string
  venueSlug: string
  serviceSlug: string
}

export function TherapistSelectionPage({ orgSlug, venueSlug, serviceSlug }: Props) {
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(convexApi.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")
  const service = useQuery(
    convexApi.queries.services.getBySlug,
    org ? { orgId: org._id, slug: serviceSlug } : "skip",
  )
  const therapists = useQuery(
    convexApi.queries.therapistServices.listTherapistsByService,
    service && venue ? { serviceId: service._id, venueId: venue._id } : "skip",
  )

  if (org === undefined || venue === undefined || service === undefined || therapists === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!org || !venue || !service) {
    return <p>Service not found</p>
  }

  const serviceParam = `?serviceId=${service._id}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a therapist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          for {service.name} ({service.duration} min — ${(service.price / 100).toFixed(2)})
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
            hrefOverride={`/${orgSlug}/${venueSlug}/book/${therapist._id}${serviceParam}`}
          />
        ))}
        <TherapistCard
          id="any"
          name="Any available"
          orgSlug={orgSlug}
          venueSlug={venueSlug}
          isWildcard
          hrefOverride={`/${orgSlug}/${venueSlug}/book/any${serviceParam}`}
        />
      </div>
    </div>
  )
}
