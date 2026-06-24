# Multi-Day Out of Office (OoO) Design

## Summary

Replace the single-day `blockouts` table with a multi-day `ooo` (Out of Office) system. An OoO spans from a start date+time to an end date+time, blocking the therapist's availability across the entire range.

## Schema

Rename table from `blockouts` to `ooo`. Pre-prod, so no migration needed — clear existing data.

```
ooo: defineTable({
  therapistId: v.id("users"),
  startDate: v.string(),       // "YYYY-MM-DD"
  startTime: v.string(),       // "HH:MM"
  endDate: v.string(),         // "YYYY-MM-DD"
  endTime: v.string(),         // "HH:MM"
  reason: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("inactive")),
})
  .index("by_therapistId", ["therapistId"])
  .index("by_therapistId_and_startDate", ["therapistId", "startDate"])
```

## Interpretation (Contiguous Span)

An OoO from `startDate/startTime` to `endDate/endTime` is one contiguous block:

- **Same-day** (startDate === endDate): blocked from startTime to endTime on that day.
- **Multi-day**: first day blocked startTime→end-of-day, interior days blocked entirely, last day blocked start-of-day→endTime.

## Slot Computation

The `BlockoutForSlots` interface in `lib/slots.ts` stays unchanged — it's still `{ date, startTime, endTime }` (per-day).

The availability query expands each OoO record into per-day effective ranges before passing to `computeAvailableSlots`:

| Day position | Effective startTime | Effective endTime |
|---|---|---|
| Same day (startDate === endDate) | `ooo.startTime` | `ooo.endTime` |
| First day | `ooo.startTime` | `"23:59"` |
| Interior day | `"00:00"` | `"23:59"` |
| Last day | `"00:00"` | `ooo.endTime` |

This expansion logic lives in a new helper: `lib/ooo.ts` → `expandOooToDateRanges(ooo, dates)`.

## Query Changes

The availability queries currently filter blockouts by `by_therapistId_and_date`. With multi-day OoOs, a record might start before the availability window but still overlap it. The query should fetch OoOs where `startDate <= endOfWindow AND endDate >= startOfWindow` (overlapping range). Since Convex indexes don't support compound range queries on two different fields, we fetch by `therapistId` with `startDate <= endOfWindow` and post-filter `endDate >= startOfWindow` in code.

Revised index usage:
```
ctx.db.query("ooo")
  .withIndex("by_therapistId_and_startDate", (q) =>
    q.eq("therapistId", therapistId).lte("startDate", endDate)
  )
  .take(200)
// then filter: .filter(o => o.endDate >= startDate && o.status === "active")
```

## Validation Rules

- `endDate >= startDate`
- If `endDate === startDate`: `endTime > startTime`
- `endDate + endTime` must not be entirely in the past (startDate+startTime may be backdated)

## Permissions

- **Owners** can create, edit, and remove OoOs for any therapist in their org (enables managing leave on behalf of staff).
- **Therapists** can only create, edit, and remove their own OoOs.
- The UI shows a therapist picker only for owners. Therapists are pinned to themselves.

## Mutations

File: `mutations/ooo.ts`

- **create** — auth guard (owner or own), active check, validation, insert with `status: "active"`
- **update** — auth guard, re-validate all fields
- **remove** — soft-delete (`status: "inactive"`)
- **activate** — set `status: "active"`

Same role-based access pattern as current blockouts: owners can manage any therapist's OoOs, therapists only their own.

## Queries

File: `queries/ooo.ts`

- **listByTherapist** — all active OoOs for a therapist (replaces `blockouts.listByTherapist`)
- **listByTherapistAndDateRange** — active OoOs overlapping a date range (for availability computation)

## Overlapping Bookings Warning

On the frontend, when the user submits an OoO form, query existing bookings in the date range for that therapist. If any non-cancelled bookings overlap, display a warning: "You have X bookings during this period that may need rescheduling." Non-blocking — the OoO is still created.

## Admin UI

Rename "Blockout" → "Out of Office" in all user-facing text.

### OoO Form (`ooo-form.tsx`)
- Start date picker + start time select
- End date picker + end time select
- Reason (optional)
- Therapist picker (owner only)
- Warning about overlapping bookings (shown after validation, before submit)

### OoO List (`ooo-list.tsx`)
- Cards showing: date range (formatted), time range, reason
- Multi-day: "Tue Jun 24, 2pm – Thu Jun 26, 12pm"
- Same-day: "Tue Jun 24, 2pm – 4pm"
- Edit/Remove actions for current+future OoOs

## Files to Change

| Action | Path |
|--------|------|
| Delete | `packages/convex/src/mutations/blockouts.ts` |
| Delete | `packages/convex/src/queries/blockouts.ts` |
| Delete | `packages/convex/src/types/blockouts.queries.ts` |
| Delete | `apps/admin/components/blockout-form.tsx` |
| Delete | `apps/admin/components/blockout-list.tsx` |
| Create | `packages/convex/src/mutations/ooo.ts` |
| Create | `packages/convex/src/queries/ooo.ts` |
| Create | `packages/convex/src/types/ooo.queries.ts` |
| Create | `packages/convex/src/lib/ooo.ts` (expansion helper) |
| Create | `apps/admin/components/ooo-form.tsx` |
| Create | `apps/admin/components/ooo-list.tsx` |
| Modify | `packages/convex/src/schema.ts` (replace `blockouts` with `ooo`) |
| Modify | `packages/convex/src/queries/availability.ts` (use new table + expansion) |
| Modify | `packages/convex/src/scripts/clearAllTables.ts` (rename in table list) |
| Modify | `apps/admin/components/schedule-page.tsx` (use ooo-list + ooo-form) |
| Modify | `apps/admin/lib/convex-api.ts` (rename blockouts → ooo) |

## Testing

- Unit tests for `expandOooToDateRanges` (same-day, multi-day, single interior day, boundary cases)
- Integration test: OoO blocks slots in the availability query
- Existing slot tests updated to use new `ooo` table name

## Deferred

- **Booking reassignment** — when a therapist is OoO, existing bookings are not auto-cancelled or reassigned. The admin handles them manually using existing reschedule/cancel tools. This is a separate feature.

## Migration

Not needed. Pre-prod — existing `blockouts` data cleared via `clearAllTables` script.
