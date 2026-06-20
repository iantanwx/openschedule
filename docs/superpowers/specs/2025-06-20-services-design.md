# Services Design

## Problem

The platform currently has a single fixed `slotDuration` per therapist schedule. Real studios offer multiple service types (e.g., 60-min relaxation massage, 90-min deep tissue) with different durations. We need a first-class "service" concept that drives slot generation and booking.

## Design Decisions

- **Service-first booking flow:** customer picks service → therapist → date → time
- **Duration lives on the service, not the schedule.** `schedules.slotDuration` is removed.
- **Auto-assignment:** when a therapist accepts an invite, they get all active org services by default.
- **Slot alignment:** 15-minute boundaries (hardcoded constant in slot generation logic).
- **Customer picks service first;** therapist list is filtered to those who offer the selected service.

## Data Model

### New table: `services`

```
services: defineTable({
  orgId: v.id("organizations"),
  name: v.string(),
  description: v.string(),
  duration: v.number(),           // minutes
  price: v.number(),              // cents (display-only, no payments)
  color: v.string(),              // hex, e.g. "#4f46e5"
  status: v.union(v.literal("active"), v.literal("archived")),
})
  .index("by_orgId", ["orgId"])
```

### New table: `therapistServices`

```
therapistServices: defineTable({
  therapistId: v.id("users"),
  serviceId: v.id("services"),
  orgId: v.id("organizations"),
})
  .index("by_therapistId", ["therapistId"])
  .index("by_serviceId", ["serviceId"])
  .index("by_orgId", ["orgId"])
  .index("by_therapistId_and_serviceId", ["therapistId", "serviceId"])
```

Join table: which therapist offers which service. One row per (therapist, service) pair.

### Modified: `bookings`

Add field:
- `serviceId: v.id("services")`

Every booking records which service was booked. The booking's `startTime`/`endTime` already encode the actual duration.

### Modified: `schedules`

Remove field:
- `slotDuration` — no longer needed; duration comes from the selected service.

## Slot Computation

`computeAvailableSlots` signature changes:

```ts
computeAvailableSlots({
  schedule: { workingDays, startTime, endTime },
  serviceDuration: number,  // replaces schedule.slotDuration
  dates,
  blockouts,
  bookings,
  venueCapacity,
  allBookingsForVenueByDate,
})
```

`generateCandidateSlots(startTime, endTime, serviceDuration)` generates candidates on 15-minute boundaries:

```ts
const SLOT_ALIGNMENT = 15; // minutes

let current = startMin;
while (current + serviceDuration <= endMin) {
  slots.push({ startTime: minutesToTime(current), endTime: minutesToTime(current + serviceDuration) });
  current += SLOT_ALIGNMENT;
}
```

This means a 90-min service on a 9:00–17:00 window yields starts at 9:00, 9:15, 9:30, ..., 15:30 (filtered by actual availability).

Overlap checks remain unchanged — they compare against bookings' concrete `startTime`/`endTime`, which already reflect their service's duration.

## Availability Query Changes

`queries/availability.ts` — both `getSlots` and `getSlotsForAllTherapists`:

- Add `serviceId: v.id("services")` to args.
- Resolve the service doc to get `service.duration`.
- Pass `serviceDuration: service.duration` to `computeAvailableSlots` instead of `schedule.slotDuration`.

## Customer Booking Flow (apps/web)

New route order:

1. **`/:orgSlug/:venueSlug`** — Venue landing. Shows service cards (name, description, duration formatted, price formatted). Customer picks a service.
2. **`/:orgSlug/:venueSlug/book/:serviceSlug`** — Therapist grid, filtered to therapists who offer this service (query `therapistServices` by serviceId, intersect with venue's active schedules). "Any Available" still works (resolves to a random qualifying therapist).
3. **`/:orgSlug/:venueSlug/book/:serviceSlug/:therapistId`** or `/any` — Date/time picker. Slots generated using `service.duration`.
4. **Confirm page** — shows service name + duration + price + therapist + date/time. Customer fills in details and submits.

The service needs a `slug` for URL routing. Add to schema:
- `slug: v.string()` on `services` table
- Index: `.index("by_orgId_and_slug", ["orgId", "slug"])`

## Admin App

### New: Services page (`/:orgSlug/services`)

- Owner-only (add to OrgNav alongside Team + Settings).
- Lists all services (active + archived toggle).
- Create/edit form: name, slug (auto-generated from name), description, duration (dropdown: 30/45/60/75/90/120), price (currency input), color (color picker or preset palette).
- Archive/unarchive (soft delete).

### Modified: Team section

- Each therapist's row shows badges for their offered services.
- Owner can toggle services on/off per therapist (adds/removes `therapistServices` rows).

### Modified: Therapist personal settings

- Therapist sees their assigned services, can remove ones they don't offer (cannot add — only owner can add services they weren't assigned).

### Modified: New Booking sheet (admin FAB)

- Step order becomes: service → therapist → date → slot → customer.
- Therapist list filtered by who offers the selected service (via `therapistServices`).

### Modified: Schedule edit form

- Remove the `slotDuration` field/picker from the form.

## Auto-assignment on Invite Acceptance

In the `member.onCreate` trigger (`betterAuth/auth.ts`), after setting `orgId`/`roles`/`active`, insert `therapistServices` rows for all active services in the org:

```ts
const services = await ctx.db
  .query("services")
  .withIndex("by_orgId", q => q.eq("orgId", org._id))
  .take(100);

const activeServices = services.filter(s => s.status === "active");

for (const service of activeServices) {
  await ctx.db.insert("therapistServices", {
    therapistId: user._id,
    serviceId: service._id,
    orgId: org._id,
  });
}
```

Also applies when the owner toggles their own therapist role (in `toggleTherapistRole` mutation).

## Backend Mutations

### `mutations/services.ts`

- `create` — owner-only. Inserts service + auto-assigns to all active therapists in the org (inserts `therapistServices` rows for each).
- `update` — owner-only. Patches name/description/duration/price/color.
- `archive` — owner-only. Sets `status: "archived"`. Removes all `therapistServices` rows for this service.
- `unarchive` — owner-only. Sets `status: "active"`. Does NOT auto-reassign (owner manually re-adds).

### `mutations/therapistServices.ts`

- `assign` — owner-only. Adds a (therapist, service) pair.
- `remove` — owner OR the therapist themselves. Deletes the row.
- `listByTherapist` — query, not mutation. Returns services offered by a therapist.

### Queries

- `queries/services.ts`:
  - `listByOrg({ orgId })` — all active services for an org
  - `getBySlug({ orgId, slug })` — resolve by slug for customer routing
- `queries/therapistServices.ts`:
  - `listByTherapist({ therapistId })` — services a therapist offers
  - `listTherapistsByService({ serviceId, venueId })` — therapists who offer a service AND have an active schedule at the venue (the filtered therapist list for customer flow)

## Migration

- Add `serviceId` to bookings as `v.optional(v.id("services"))` initially (existing bookings won't have it).
- Keep `slotDuration` as `v.optional(v.number())` on schedules during migration; remove once all code paths use service duration.
- Write a migration script to backfill: for each schedule with a `slotDuration`, create a default service with that duration and assign it to the therapist + backfill existing bookings' `serviceId`.

## Out of Scope

- Payments / checkout (price is display-only).
- Service categories / grouping.
- Variable pricing per therapist (all therapists charge the same for a given service).
- Buffer time between appointments (future enhancement).
