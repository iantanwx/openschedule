# Venue Address + Google Maps Integration

## Summary

Add an address field to venues with Google Places Autocomplete for input, store coordinates, and display a static map + address on the customer booking flow (sidebar + confirmation page).

## Wireframes

See `.superpowers/brainstorm/21549-1782094023/content/venue-address-mockup.html` — shows both placements side by side:
- **Left panel:** Booking summary sidebar with Location section (small map + address at the bottom)
- **Right panel:** Confirmation page with location card (larger map, address, "Open in Google Maps" link)

## Schema

Add two optional fields to the `venues` table:

```ts
address: v.optional(v.string()),        // formatted address from Places
coordinates: v.optional(v.object({
  lat: v.number(),
  lng: v.number(),
})),
```

## Admin — Address Input

- Venue settings form (`venue-settings-page.tsx`): add a Google Places Autocomplete input below the timezone field. On place selection, store `address` (formatted) and `coordinates` (geometry.location lat/lng).
- Onboarding step 2 (venue creation in `onboarding/page.tsx`): same autocomplete input.
- Uses `@react-google-maps/api` or raw Google Maps JavaScript API `Autocomplete` widget.
- Env var: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (admin `.env.local`).

## Customer Web — Map Display

### Booking summary sidebar (`booking-summary.tsx`)

Below existing venue/date/time info, render a "Location" section (only when `venue.address` is set):
- Google Static Maps image: 120px tall, rounded corners, zoom 15, single red marker at coordinates.
- Address text below the map in 13px muted color.

### Confirmation page (`booking-confirmation.tsx`)

After booking details card, render a location card (only when address is set):
- Static map: 160px tall, full-width in the card, no border radius on top.
- Below: venue name (bold), address text, "Open in Google Maps" link (`https://www.google.com/maps/search/?api=1&query={lat},{lng}`).

### Static Maps URL format

```
https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=15&size=600x240&scale=2&markers=color:red|{lat},{lng}&key={NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
```

Env var: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (web `.env.local`).

## Queries

- `venues.getBySlug` (public, customer-facing): add `address` and `coordinates` to the returned `VenuePublic` shape.
- `venues.getBySlugFull` (admin): already returns full doc — no change needed.
- `venues.create` and `venues.update` mutations: accept optional `address` and `coordinates` args.

## Error Handling

- If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset, autocomplete input falls back to a plain text input (address stored without coordinates).
- If coordinates are missing but address exists, static map is not rendered (just show address text).
- If address is empty, location section is hidden entirely.

## Google APIs Required

- Maps JavaScript API (Places Autocomplete widget)
- Places API (New) (autocomplete data)
- Maps Static API (static map images)

Single API key, restricted by HTTP referrers.

## Out of Scope

- Geocoding API (not needed — Places Autocomplete returns coordinates)
- Interactive/embedded maps (static image is sufficient)
- Directions or distance calculation
