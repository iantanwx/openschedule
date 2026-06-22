"use client"

interface VenueMapProps {
  address: string
  coordinates: { lat: number; lng: number }
  placeId?: string
  venueName?: string
  height?: number
  showLink?: boolean
}

export function VenueMap({ address, coordinates, placeId, venueName, height = 120, showLink = false }: VenueMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapsUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`

  const staticMapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=15&size=600x${height * 2}&scale=2&markers=color:red|${coordinates.lat},${coordinates.lng}&key=${apiKey}`
    : null

  return (
    <div>
      {staticMapUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={staticMapUrl}
            alt={`Map showing ${venueName ?? "venue"} location`}
            className="w-full rounded-lg object-cover"
            style={{ height: `${height}px` }}
          />
        </a>
      )}
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {address}
      </p>
      {showLink && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm text-primary hover:underline"
        >
          Open in Google Maps →
        </a>
      )}
    </div>
  )
}
