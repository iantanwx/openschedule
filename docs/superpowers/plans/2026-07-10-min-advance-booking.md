# Minimum Advance Booking Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow venues to enforce a minimum advance booking window for customer-created bookings, filtering slots and rejecting late submissions.

**Architecture:** Two new optional fields on the `venues` schema, a new param in the pure `computeAvailableSlots` function, resolver logic in availability queries, a server-side guard in the booking mutation, and a toggle + hours input in the admin venue settings form.

**Tech Stack:** Convex (schema, mutations, queries), Vitest (pure function tests), React (admin form), shadcn/ui components, date-fns-tz

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/convex/src/schema.ts` | Add two optional venue fields |
| Modify | `packages/convex/src/lib/slots.ts` | Add `minAdvanceMinutes` param, filtering logic |
| Modify | `packages/convex/src/queries/availability.ts` | Resolve venue config → pass to slot computation |
| Modify | `packages/convex/src/mutations/bookings.ts` | Server-side guard for customer bookings |
| Modify | `packages/convex/src/mutations/venues.ts` | Accept + validate new fields in `update` mutation |
| Modify | `apps/admin/components/venue-settings-page.tsx` | Toggle + hours input UI |
| Modify | `packages/convex/src/tests/slots.test.ts` | New test cases for advance-time filtering |

---

### Task 1: Schema — Add venue fields

**Files:**
- Modify: `packages/convex/src/schema.ts:14-30`

- [ ] **Step 1: Add the two new optional fields to the venues table**

In `packages/convex/src/schema.ts`, add `minAdvanceBookingEnabled` and `minAdvanceBookingMinutes` to the venues table definition:

```ts
  venues: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    placeId: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    minAdvanceBookingEnabled: v.optional(v.boolean()),
    minAdvanceBookingMinutes: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"]),
```

- [ ] **Step 2: Commit**

```bash
git add packages/convex/src/schema.ts
git commit -m "feat: add minAdvanceBooking fields to venues schema"
```

---

### Task 2: Slot computation — Add `minAdvanceMinutes` param

**Files:**
- Modify: `packages/convex/src/lib/slots.ts:35-48,94-101`

- [ ] **Step 1: Write the failing test**

Add a new test to `packages/convex/src/tests/slots.test.ts`:

```ts
  test("filters slots within minAdvanceMinutes on today", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"], // Monday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 90,
    });

    // nowTime=10:00, advance=90min → cutoff=11:30
    // Slots with startTime < 11:30 are excluded
    // First valid slot starts at 11:30
    const slots = result["2025-06-16"]!;
    expect(slots[0]).toEqual({ startTime: "11:30", endTime: "12:30" });
    // From 11:30 to 16:00 at 15-min intervals: (16:00-11:30)/15 + 1 = 19
    expect(slots).toHaveLength(19);
  });

  test("does not filter advance time on future dates", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16", "2025-06-17"], // Mon, Tue
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 90,
    });

    // Tomorrow should have all 29 slots (no advance filtering)
    expect(result["2025-06-17"]).toHaveLength(29);
  });

  test("minAdvanceMinutes=0 falls back to existing past-time filter", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 0,
    });

    // With minAdvanceMinutes=0, only past slots are filtered (startTime < 10:00)
    // First valid: 10:00. From 10:00 to 16:00 at 15-min = 25 slots
    expect(result["2025-06-16"]![0]).toEqual({ startTime: "10:00", endTime: "11:00" });
    expect(result["2025-06-16"]).toHaveLength(25);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/convex/src/tests/slots.test.ts`
Expected: FAIL — `minAdvanceMinutes` not recognized in input type

- [ ] **Step 3: Add `minAdvanceMinutes` to `ComputeSlotsInput` interface**

In `packages/convex/src/lib/slots.ts`, update the interface:

```ts
export interface ComputeSlotsInput {
  schedule: ScheduleForSlots;
  serviceDuration: number;
  dates: string[];
  blockouts: BlockoutForSlots[];
  bookings: BookingForSlots[];
  venueCapacity: number;
  /** All active bookings (any therapist) at the venue, grouped by date — for capacity check */
  allBookingsForVenueByDate: Record<string, VenueBookingSlot[]>;
  /** Today's date in venue timezone (YYYY-MM-DD) — used to filter past slots */
  todayDate?: string;
  /** Current time in venue timezone (HH:MM) — slots before this on todayDate are excluded */
  nowTime?: string;
  /** Minimum advance booking time in minutes — slots within this window from now are excluded on todayDate */
  minAdvanceMinutes?: number;
}
```

- [ ] **Step 4: Update the filtering logic in `computeAvailableSlots`**

Replace the existing past-slot filter block (lines 96-100) with logic that handles both cases:

```ts
    const available = candidates.filter((slot) => {
      // Filter out past slots and slots within advance booking window for today
      if (todayDate && date === todayDate && nowMinutes !== null) {
        const minAdvance = input.minAdvanceMinutes ?? 0;
        const cutoffMinutes = nowMinutes + minAdvance;
        if (timeToMinutes(slot.startTime) < cutoffMinutes) {
          return false;
        }
      }

      // Check blockout overlap
      for (const blockout of dateBlockouts) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, blockout.startTime, blockout.endTime)) {
          return false;
        }
      }

      // Check therapist booking overlap
      for (const booking of dateBookings) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, booking.startTime, booking.endTime)) {
          return false;
        }
      }

      // Check venue capacity
      const overlappingVenueBookings = venueBookingsForDate.filter((vb) =>
        timeRangesOverlap(slot.startTime, slot.endTime, vb.startTime, vb.endTime),
      );
      if (overlappingVenueBookings.length >= venueCapacity) {
        return false;
      }

      return true;
    });
```

Note: When `minAdvanceMinutes` is `0` or `undefined`, `cutoffMinutes` equals `nowMinutes + 0` which is exactly the existing behavior (filter past slots). This preserves backward compatibility.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run packages/convex/src/tests/slots.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/lib/slots.ts packages/convex/src/tests/slots.test.ts
git commit -m "feat: add minAdvanceMinutes filtering to computeAvailableSlots"
```

---

### Task 3: Availability queries — Pass resolved advance minutes

**Files:**
- Modify: `packages/convex/src/queries/availability.ts:82-96,185-199`

- [ ] **Step 1: Add a helper to resolve the advance minutes value**

At the top of `packages/convex/src/queries/availability.ts` (after imports), add:

```ts
/** Resolve min advance booking minutes from venue config. Returns 0 if disabled. */
function resolveMinAdvanceMinutes(venue: { minAdvanceBookingEnabled?: boolean; minAdvanceBookingMinutes?: number }): number {
  if (!venue.minAdvanceBookingEnabled) return 0;
  return venue.minAdvanceBookingMinutes ?? 90;
}
```

- [ ] **Step 2: Pass `minAdvanceMinutes` in `getSlots`**

Update the `computeAvailableSlots` call in `getSlots` (around line 82):

```ts
    return computeAvailableSlots({
      schedule: {
        workingDays: schedule.workingDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      serviceDuration: service.duration,
      dates,
      blockouts,
      bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
      venueCapacity: venue.capacity,
      allBookingsForVenueByDate,
      todayDate: today,
      nowTime,
      minAdvanceMinutes: resolveMinAdvanceMinutes(venue),
    });
```

- [ ] **Step 3: Pass `minAdvanceMinutes` in `getSlotsForAllTherapists`**

Update the `computeAvailableSlots` call in the loop (around line 185):

```ts
      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        serviceDuration: service.duration,
        dates: scheduleDates,
        blockouts,
        bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
        venueCapacity: venue.capacity,
        allBookingsForVenueByDate,
        todayDate: today,
        nowTime,
        minAdvanceMinutes: resolveMinAdvanceMinutes(venue),
      });
```

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/queries/availability.ts
git commit -m "feat: pass resolved minAdvanceMinutes to slot computation"
```

---

### Task 4: Server-side guard in booking creation

**Files:**
- Modify: `packages/convex/src/mutations/bookings.ts:26-50`

- [ ] **Step 1: Update imports in bookings.ts**

At line 4, expand the import from `"../lib/time"` to include the additional utilities:

```ts
import { timeRangesOverlap, todayInTimezone, nowTimeInTimezone, timeToMinutes } from "../lib/time";
```

- [ ] **Step 2: Add advance-time validation after venue lookup**

In the `create` mutation handler, after the venue null check (line 29) and before the therapist check (line 33), add:

```ts
    // Enforce minimum advance booking time for customer bookings
    if (args.createdBy === "customer" && venue.minAdvanceBookingEnabled) {
      const advanceMinutes = venue.minAdvanceBookingMinutes ?? 90;
      const today = todayInTimezone(venue.timezone);
      if (args.date === today) {
        const nowTime = nowTimeInTimezone(venue.timezone);
        const cutoff = timeToMinutes(nowTime) + advanceMinutes;
        if (timeToMinutes(args.startTime) < cutoff) {
          throw new Error("This time slot is no longer available for online booking");
        }
      }
    }
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/mutations/bookings.ts
git commit -m "feat: server-side advance booking guard for customer bookings"
```

---

### Task 5: Venue update mutation — Accept and validate new fields

**Files:**
- Modify: `packages/convex/src/mutations/venues.ts:38-84`

- [ ] **Step 1: Add the new args to the `update` mutation**

Add after `coverImageId` in the args object (line 51):

```ts
    minAdvanceBookingEnabled: v.optional(v.boolean()),
    minAdvanceBookingMinutes: v.optional(v.number()),
```

- [ ] **Step 2: Add validation logic in the handler**

After the slug uniqueness check (line 75), before building the patch, add:

```ts
    // Validate minAdvanceBookingMinutes if provided
    if (fields.minAdvanceBookingMinutes !== undefined) {
      if (fields.minAdvanceBookingMinutes < 30) {
        throw new Error("Minimum advance booking time must be at least 30 minutes");
      }
      if (fields.minAdvanceBookingMinutes % 30 !== 0) {
        throw new Error("Minimum advance booking time must be divisible by 30 minutes");
      }
    }
```

- [ ] **Step 3: Update the patch type annotation**

The existing patch type `Record<string, string | number | { lat: number; lng: number }>` needs to include `boolean`:

```ts
    const patch: Record<string, string | number | boolean | { lat: number; lng: number }> = {};
```

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/mutations/venues.ts
git commit -m "feat: accept and validate minAdvanceBooking fields in venue update"
```

---

### Task 6: Admin UI — Toggle and hours input

**Files:**
- Modify: `apps/admin/components/venue-settings-page.tsx`

- [ ] **Step 1: Add state variables for the new fields**

After `const [coverImageId, setCoverImageId] = useState<string | null>(null);` (line 38), add:

```tsx
  const [minAdvanceBookingEnabled, setMinAdvanceBookingEnabled] = useState(false);
  const [minAdvanceBookingHours, setMinAdvanceBookingHours] = useState(1.5);
```

- [ ] **Step 2: Initialize from venue data**

In the `if (venue && !isInitialized)` block (around line 52-63), add before `setIsInitialized(true)`:

```tsx
    setMinAdvanceBookingEnabled(venue.minAdvanceBookingEnabled ?? false);
    setMinAdvanceBookingHours((venue.minAdvanceBookingMinutes ?? 90) / 60);
```

- [ ] **Step 3: Include in the mutation call**

In `handleSave`, add the new fields to the `updateVenue` call:

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
        placeId: placeId || undefined,
        description: description || undefined,
        coverImageId: coverImageId || undefined,
        minAdvanceBookingEnabled,
        minAdvanceBookingMinutes: minAdvanceBookingEnabled
          ? Math.round(minAdvanceBookingHours * 60)
          : undefined,
      });
```

- [ ] **Step 4: Add the UI elements**

After the Day Start/Day End grid (after line 202, before the address section), add:

```tsx
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="venue-min-advance"
                checked={minAdvanceBookingEnabled}
                onChange={(e) => setMinAdvanceBookingEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="venue-min-advance">
                Require minimum advance notice for online bookings
              </Label>
            </div>
            {minAdvanceBookingEnabled && (
              <div className="ml-6 space-y-1">
                <Label htmlFor="venue-min-advance-hours">Minimum advance notice</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="venue-min-advance-hours"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={minAdvanceBookingHours}
                    onChange={(e) => setMinAdvanceBookingHours(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 5: Add the Switch import (if using shadcn Switch instead of native checkbox)**

Check if a `Switch` component exists in the UI package. If yes, prefer it for consistency:

```tsx
import { Switch } from "@opencal/ui/components/switch";
```

And replace the `<input type="checkbox">` with:

```tsx
              <Switch
                id="venue-min-advance"
                checked={minAdvanceBookingEnabled}
                onCheckedChange={setMinAdvanceBookingEnabled}
              />
```

If `Switch` is not available, the native checkbox approach is fine.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/components/venue-settings-page.tsx
git commit -m "feat: add min advance booking toggle and hours input to venue settings"
```

---

### Task 7: Type check and final verification

**Files:**
- All modified files

- [ ] **Step 1: Run type check**

Run: `pnpm tsc --noEmit` (from workspace root, or from `packages/convex` depending on turbo config)

Alternative: `pnpm turbo typecheck`

Expected: No type errors

- [ ] **Step 2: Run all slot tests**

Run: `pnpm vitest run packages/convex/src/tests/slots.test.ts`

Expected: ALL PASS (including the 3 new tests from Task 2)

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run` (from `packages/convex`)

Expected: ALL PASS

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type/test issues from min advance booking feature"
```
