# Minimum Advance Booking Time

## Summary

Venues can require customers to book a minimum amount of time in advance. For example, a 90-minute advance requirement means a 3:00 PM slot must be booked by 1:30 PM at the latest. The restriction applies only to customer-facing booking and rescheduling flows — therapists and owners bypass it entirely.

## Schema

Two new optional fields on the `venues` table:

```ts
minAdvanceBookingEnabled: v.optional(v.boolean()),  // defaults to false when absent
minAdvanceBookingMinutes: v.optional(v.number()),   // defaults to 90 when enabled but unset
```

Storage is in minutes (integer). Validation rules enforced at the mutation level:
- Must be >= 30
- Must be divisible by 30

## Slot Computation

`computeAvailableSlots` in `packages/convex/src/lib/slots.ts` gains a new optional parameter `minAdvanceMinutes: number | undefined`.

Behavior:
- If `minAdvanceMinutes > 0` and the date is today: exclude any slot where `slotStartTime < nowTime + minAdvanceMinutes`
- If `minAdvanceMinutes` is `0` or `undefined`: existing behavior (filter slots where `startTime < nowTime`)
- For dates after today: no advance-time filtering needed (the slot is already far enough ahead)

The callers in `packages/convex/src/queries/availability.ts` (`getSlots`, `getSlotsForAllTherapists`) read the venue's config, resolve to a number:
- Enabled and value set → use the value
- Enabled but value unset → 90
- Disabled or field absent → 0

Pass the resolved value to `computeAvailableSlots`.

## Server-Side Enforcement

In `packages/convex/src/mutations/bookings.ts`, the `create` mutation adds a guard:

1. Only when `createdBy === "customer"`
2. Read venue's `minAdvanceBookingEnabled` and `minAdvanceBookingMinutes`
3. If enabled: compute the cutoff time as `now + minAdvanceMinutes` in the venue's timezone
4. If the booking date is today and `startTime` is before the cutoff, reject with error: `"This time slot is no longer available for online booking"`
5. If `createdBy` is `"therapist"` or `"owner"`: skip entirely

The same check applies to any future customer-facing `reschedule` mutation — validate the new target time against the same rule.

## Admin Configuration UI

Location: venue settings page in `apps/admin`.

Components:
- Toggle: "Require minimum advance notice for online bookings"
- When enabled: a number input labeled "Minimum advance notice" with "hours" suffix
  - `step="0.5"`, `min="0.5"` (no max)
  - Stepper arrows increment/decrement by 0.5 hours
  - Accepts manual entry of values divisible by 0.5 (e.g., `0.5`, `1.5`, `2`, `48`)
  - Rejects values not divisible by 0.5 (e.g., `1.2`, `0.7`)
  - Default value when first enabled: `1.5` (90 minutes)
- When disabled: duration input is hidden, restriction is inactive
- Conversion: UI works in hours, stored as minutes (`hours * 60`)

## Customer-Facing UI

No explicit messaging. Slots that fall within the advance booking window simply don't appear in the available slots list. No "requires X advance notice" text is shown.

## Scope & Boundaries

- Applies to: customer-created bookings and future customer self-service rescheduling
- Does not apply to: therapist or owner bookings (bypassed entirely)
- Lives on: `venues` table (per-venue setting, applies to all therapists at that venue)
- Does not affect: existing `availabilityHorizonDays` on schedules (that's a separate max-future-days constraint)

## Edge Cases

- Race condition: customer loads slots at valid time, submits after cutoff → server-side guard rejects with clear error
- Venue without the fields set: no restriction (backward compatible)
- Admin enables toggle without changing duration: defaults to 90 minutes
- Very large values (e.g., 48 hours): valid — effectively means no same-day or next-day online booking depending on time
