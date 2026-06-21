"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { ServiceCard } from "@/components/service-card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

const convexApi = api as unknown as {
  queries: {
    organizations: { getBySlug: FunctionReference<"query"> }
    venues: { getBySlug: FunctionReference<"query"> }
    services: { listByOrg: FunctionReference<"query"> }
  }
}

interface ServicesPageProps {
  orgSlug: string
  venueSlug: string
}

export function ServicesPage({ orgSlug, venueSlug }: ServicesPageProps) {
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(convexApi.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")
  const services = useQuery(
    convexApi.queries.services.listByOrg,
    org ? { orgId: org._id } : "skip",
  )

  if (org === undefined || venue === undefined || services === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  if (!services || services.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Book an appointment</h1>
        <p className="text-muted-foreground">No services available at this time.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a service to view available times
        </p>
      </div>
      <div className="space-y-4">
        {(services as Array<{ _id: string; slug: string; name: string; description: string; duration: number; price: number; color: string }>).map((service) => (
          <ServiceCard
            key={service._id}
            id={service._id}
            slug={service.slug}
            name={service.name}
            description={service.description}
            duration={service.duration}
            price={service.price}
            color={service.color}
            orgSlug={orgSlug}
            venueSlug={venueSlug}
          />
        ))}
      </div>
    </div>
  )
}
