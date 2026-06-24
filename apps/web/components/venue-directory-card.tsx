"use client"

import Link from "next/link"

interface VenueDirectoryCardProps {
  venue: {
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
}

export function VenueDirectoryCard({ venue }: VenueDirectoryCardProps) {
  const href = `/${venue.org.slug}/${venue.slug}`
  const showVenueName = venue.name !== venue.org.name

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      {/* Cover image or gradient placeholder */}
      <div className="h-[240px] w-full overflow-hidden">
        {venue.coverImageUrl ? (
          <img
            src={venue.coverImageUrl}
            alt={`${venue.name} cover`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
        )}
      </div>

      {/* Card content */}
      <div className="space-y-1 p-4">
        <p className="text-sm font-bold">{venue.org.name}</p>
        {showVenueName && (
          <p className="text-sm text-foreground">{venue.name}</p>
        )}
        {venue.address && (
          <p className="truncate text-xs text-muted-foreground">{venue.address}</p>
        )}
        {venue.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {venue.description}
          </p>
        )}
      </div>
    </Link>
  )
}
