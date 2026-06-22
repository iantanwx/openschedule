# Venue Address + Google Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add venue address with Google Maps to the customer booking flow (sidebar + confirmation page) and admin venue settings.

**Architecture:** Store `address` (string) and `coordinates` ({lat, lng}) on the venues table. Admin uses Google Places Autocomplete for input. Customer app renders Google Static Maps images. No server-side geocoding needed.

**Tech Stack:** Google Maps JavaScript API (Places Autocomplete), Google Maps Static API, @react-google-maps/api, Convex, Next.js 16, React 19.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/convex/src/schema.ts` | Modify | Add address + coordinates fields |
| `packages/convex/src/types/venues.queries.ts` | Modify | Add address + coordinates to types |
| `packages/convex/src/queries/venues.ts` | Modify | Include address/coordinates in projections |
| `packages/convex/src/mutations/venues.ts` | Modify | Accept address + coordinates in create/update |
| `apps/admin/components/address-autocomplete.tsx` | Create | Google Places Autocomplete input |
| `apps/admin/components/google-maps-provider.tsx` | Create | LoadScript wrapper |
| `apps/admin/components/venue-settings-page.tsx` | Modify | Add address field |
| `apps/admin/app/(protected)/onboarding/page.tsx` | Modify | Add address field to step 2 |
| `apps/admin/lib/convex-api.ts` | Modify | Update venue types |
| `apps/web/components/venue-map.tsx` | Create | Static map image + address display |
| `apps/web/components/booking-summary.tsx` | Modify | Add location section |
| `apps/web/components/booking-confirmation.tsx` | Modify | Add location card |

---

### Task 1: Schema + Types + Queries

**Files:**
- Modify: `packages/convex/src/schema.ts:13-24`
- Modify: `packages/convex/src/types/venues.queries.ts`
- Modify: `packages/convex/src/queries/venues.ts`
- Modify: `packages/convex/src/mutations/venues.ts`

- [ ] **Step 1: Add fields to schema**

In `packages/convex/src/schema.ts`, add after `dayEnd: v.string(),` (line 20):

```ts
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
```

- [ ] **Step 2: Update venue types**

In `packages/convex/src/types/venues.queries.ts`, update both types:

```ts
import { Doc } from "../_generated/dataModel";

/** Full venue for admin */
export type Venue = Pick<Doc<"venues">, "_id" | "_creationTime" | "orgId" | "name" | "slug" | "timezone" | "capacity" | "dayStart" | "dayEnd" | "status" | "address" | "coordinates">;

/** Public venue info for customer app (no capacity exposed) */
export type VenuePublic = Pick<Doc<"venues">, "_id" | "name" | "slug" | "timezone" | "address" | "coordinates">;
```

- [ ] **Step 3: Update query projections**

In `packages/convex/src/queries/venues.ts`:

Update `listByOrg` (line 13-14) to include address and coordinates in the return:
```ts
    return activeVenues.map(({ _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status, address, coordinates }) => ({
      _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status, address, coordinates,
    }));
```

Update `listByOrgPublic` (line 27) to include address and coordinates:
```ts
    return activeVenues.map(({ _id, name, slug, timezone, address, coordinates }) => ({ _id, name, slug, timezone, address, coordinates }));
```

Update `getBySlug` (line 41) to include address and coordinates:
```ts
    return { _id: venue._id, name: venue.name, slug: venue.slug, timezone: venue.timezone, address: venue.address, coordinates: venue.coordinates };
```

Update `getBySlugFull` (line 55-59) to include address and coordinates:
```ts
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status, address: venue.address, coordinates: venue.coordinates,
    };
```

Update `get` (line 69-73) to include address and coordinates:
```ts
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status, address: venue.address, coordinates: venue.coordinates,
    };
```

- [ ] **Step 4: Update mutations to accept address + coordinates**

In `packages/convex/src/mutations/venues.ts`:

Update `create` args (after line 13 `dayEnd: v.string(),`):
```ts
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
```

Update `update` args (after line 41 `dayEnd: v.optional(v.string()),`):
```ts
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
```

The existing spread/patch logic in both handlers already handles optional fields correctly.

- [ ] **Step 5: Run codegen + typecheck**

Run:
```bash
cd packages/convex && pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/types/venues.queries.ts packages/convex/src/queries/venues.ts packages/convex/src/mutations/venues.ts
git commit -m "feat(convex): add address and coordinates fields to venues"
```

---

### Task 2: Admin — Google Maps Provider + Address Autocomplete

**Files:**
- Create: `apps/admin/components/google-maps-provider.tsx`
- Create: `apps/admin/components/address-autocomplete.tsx`

- [ ] **Step 1: Install @react-google-maps/api**

```bash
pnpm --filter admin add @react-google-maps/api
```

- [ ] **Step 2: Create GoogleMapsProvider**

Create `apps/admin/components/google-maps-provider.tsx`:

```tsx
"use client";

import { LoadScript } from "@react-google-maps/api";
import type { ReactNode } from "react";

const LIBRARIES: ("places")[] = ["places"];

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={LIBRARIES}>
      {children}
    </LoadScript>
  );
}
```

- [ ] **Step 3: Create AddressAutocomplete**

Create `apps/admin/components/address-autocomplete.tsx`:

```tsx
"use client";

import { useRef, useCallback } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { Input } from "@openschedule/ui/components/input";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  id?: string;
}

export function AddressAutocomplete({ value, onChange, placeholder, id }: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    const formattedAddress = place.formatted_address ?? "";
    const location = place.geometry?.location;
    const coordinates = location
      ? { lat: location.lat(), lng: location.lng() }
      : null;

    onChange(formattedAddress, coordinates);
  }, [onChange]);

  // Fallback to plain input if no API key
  if (!apiKey) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder ?? "Enter address"}
      />
    );
  }

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder ?? "Start typing an address..."}
      />
    </Autocomplete>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/google-maps-provider.tsx apps/admin/components/address-autocomplete.tsx apps/admin/package.json pnpm-lock.yaml
git commit -m "feat(admin): add Google Maps provider and address autocomplete component"
```

---

### Task 3: Admin — Wire Address Into Venue Settings + Onboarding

**Files:**
- Modify: `apps/admin/components/venue-settings-page.tsx`
- Modify: `apps/admin/app/(protected)/onboarding/page.tsx`
- Modify: `apps/admin/app/layout.tsx`
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Add GoogleMapsProvider to admin layout**

In `apps/admin/app/layout.tsx`, wrap ConvexClientProvider children with GoogleMapsProvider:

```tsx
import { GoogleMapsProvider } from "@/components/google-maps-provider";
```

Inside the body:
```tsx
<body>
  <ThemeProvider>
    <ConvexClientProvider>
      <GoogleMapsProvider>
        {children}
      </GoogleMapsProvider>
    </ConvexClientProvider>
  </ThemeProvider>
  <Toaster position="top-right" />
</body>
```

- [ ] **Step 2: Update convex-api.ts venue mutation types**

In `apps/admin/lib/convex-api.ts`, update the `venues.create` and `venues.update` mutation type entries to include `address?: string` and `coordinates?: { lat: number; lng: number }` in their args.

- [ ] **Step 3: Add address to venue settings page**

In `apps/admin/components/venue-settings-page.tsx`:

Add import:
```tsx
import { AddressAutocomplete } from "./address-autocomplete";
```

Add state (after `dayEnd` state):
```tsx
const [address, setAddress] = useState("");
const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
```

In the initialization block (after `setDayEnd(venue.dayEnd)`):
```tsx
    setAddress(venue.address ?? "");
    setCoordinates(venue.coordinates ?? null);
```

Add address field in the form (after the Day Start/End grid, before the buttons):
```tsx
          <div className="space-y-1">
            <Label htmlFor="venue-address">Address</Label>
            <AddressAutocomplete
              id="venue-address"
              value={address}
              onChange={(addr, coords) => {
                setAddress(addr);
                if (coords) setCoordinates(coords);
              }}
              placeholder="Start typing an address..."
            />
          </div>
```

Update `handleSave` to include address and coordinates:
```tsx
    await updateVenue({
      id: venue._id,
      name: venueName,
      timezone,
      capacity,
      dayStart,
      dayEnd,
      address: address || undefined,
      coordinates: coordinates || undefined,
    });
```

- [ ] **Step 4: Add address to onboarding step 2**

In `apps/admin/app/(protected)/onboarding/page.tsx`:

Add import:
```tsx
import { AddressAutocomplete } from "@/components/address-autocomplete";
```

Add state (after the venue fields):
```tsx
  const [address, setAddress] = useState("");
  const [venueCoordinates, setVenueCoordinates] = useState<{ lat: number; lng: number } | null>(null);
```

Add address field in step 2 form (after the timezone Select, before the capacity field):
```tsx
              <div className="space-y-2">
                <Label htmlFor="venue-address">Address</Label>
                <AddressAutocomplete
                  id="venue-address"
                  value={address}
                  onChange={(addr, coords) => {
                    setAddress(addr);
                    if (coords) setVenueCoordinates(coords);
                  }}
                  placeholder="Start typing an address..."
                />
              </div>
```

Update `handleCreateVenue` to pass address and coordinates:
```tsx
      await createVenue({
        orgId: orgId as any,
        name: venueName,
        slug: venueSlug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
        address: address || undefined,
        coordinates: venueCoordinates || undefined,
      });
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/components/venue-settings-page.tsx apps/admin/app/\(protected\)/onboarding/page.tsx apps/admin/app/layout.tsx apps/admin/lib/convex-api.ts
git commit -m "feat(admin): wire address autocomplete into venue settings and onboarding"
```

---

### Task 4: Customer Web — Venue Map Component

**Files:**
- Create: `apps/web/components/venue-map.tsx`

- [ ] **Step 1: Create VenueMap component**

Create `apps/web/components/venue-map.tsx`:

```tsx
"use client"

interface VenueMapProps {
  address: string
  coordinates: { lat: number; lng: number }
  venueName?: string
  /** Height of the static map image */
  height?: number
  /** Show "Open in Google Maps" link */
  showLink?: boolean
}

export function VenueMap({ address, coordinates, venueName, height = 120, showLink = false }: VenueMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`

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
          Open in Google Maps &rarr;
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/venue-map.tsx
git commit -m "feat(web): add VenueMap component for static Google Maps display"
```

---

### Task 5: Customer Web — Add Map to Booking Summary + Confirmation

**Files:**
- Modify: `apps/web/components/booking-summary.tsx`
- Modify: `apps/web/components/booking-confirmation.tsx`

- [ ] **Step 1: Add location to booking summary sidebar**

In `apps/web/components/booking-summary.tsx`:

Add import:
```tsx
import { VenueMap } from "./venue-map"
```

Update the `convexApi` cast to include `address` and `coordinates` on the venue query return type (update the `venues.getBySlug` type reference to return the public venue shape that now includes these fields).

After the date/time section (before the closing `</div>` of the main return), add:
```tsx
      {venue.address && venue.coordinates && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
          <VenueMap
            address={venue.address}
            coordinates={venue.coordinates}
            venueName={venue.name}
            height={120}
          />
        </div>
      )}
```

- [ ] **Step 2: Add location card to booking confirmation**

In `apps/web/components/booking-confirmation.tsx`:

Add import:
```tsx
import { VenueMap } from "./venue-map"
```

The confirmation page needs the venue data. It currently queries the booking but not the venue directly. Add a venue query (using the booking's venueId is not directly available in the public booking shape, so query via org slug + venue slug which are available as route params passed as props).

Add `orgSlug` and `venueSlug` props (they should already be passed from the page component — check the existing props). Use those to query the venue:

```tsx
const venue = useQuery(venueGetBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")
```

After the cancel-note paragraph, add:
```tsx
      {venue && venue.address && venue.coordinates && (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <VenueMap
            address={venue.address}
            coordinates={venue.coordinates}
            venueName={venue.name}
            height={160}
            showLink
          />
        </div>
      )}
```

- [ ] **Step 3: Add env var to web app .env.local**

Create or update `apps/web/.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<same key as admin>
```

(Instruct developer: set this to the same Google Maps API key used in admin.)

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/booking-summary.tsx apps/web/components/booking-confirmation.tsx
git commit -m "feat(web): show venue map in booking summary sidebar and confirmation page"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Typecheck all packages**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter admin typecheck
pnpm --filter web typecheck
```

Expected: Only 2 pre-existing errors each.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @openschedule/convex test
```

Expected: 46/46 pass.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: No new errors in touched files.

- [ ] **Step 4: E2E (manual)**

1. Admin: Go to venue settings, type an address in the autocomplete field, select a suggestion, save. Verify the map shows correctly.
2. Customer: Visit the booking page — verify the sidebar shows a small map + address below the venue name.
3. Customer: Complete a booking — verify the confirmation page shows a location card with the larger map and "Open in Google Maps" link.
