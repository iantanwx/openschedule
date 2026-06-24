# Inline OoO on Schedule Card — Design Spec

## Problem

The Schedule tab has two UX bugs and a structural issue:

1. The therapist filter dropdown in the OoO section doesn't work (state defaults to first therapist, Select value mismatch)
2. OoO entries don't show which therapist they belong to
3. The standalone "Out of Office" section is disconnected from the schedule cards above — users must mentally map therapists between the two sections

Bug #32 from qa-bugs.md: "Move OoO into individual therapist modal in Schedule page. Expose 'OoO' button that opens modal. Display OoO inline in therapist schedule card."

## Solution

Move OoO entries inline into each therapist's schedule card. Remove the standalone OoO section entirely.

## Design

### Schedule Card (expanded)

Each `ScheduleCard` shows:
1. Therapist name + Edit button (existing)
2. Working days badges (existing)
3. Hours + horizon (existing)
4. **New: OoO sub-section** — separator line, "Out of Office" label + "+ Add" button, list of upcoming entries

```
┌──────────────────────────────────────┐
│ Jane Doe                     [Edit]  │
│ Mon Tue Wed Thu Fri                  │
│ 09:00 – 17:00 · 30 day horizon      │
│                                      │
│ ── Out of Office ──────── [+ Add]    │
│ Tue Jun 24, 2pm – 4pm               │
│ Mon Jun 30 – Fri Jul 4  · Vacation  │
└──────────────────────────────────────┘
```

### OoO entries display

- Only **future** entries shown (endDate >= today). Past entries hidden.
- Each entry shows: formatted date range + optional reason
- Each entry has Edit and Remove actions (inline text buttons)
- If no upcoming OoO: show nothing (not even "No entries" text — keep the card compact)
- Date formatting reuses existing `formatOooRange` function

### Interactions

- **Edit schedule:** Click anywhere on the card header area (existing behavior unchanged)
- **Add OoO:** Click "+ Add" button in OoO sub-section → opens `OooForm` dialog with `therapistId` pre-locked to that card's therapist
- **Edit OoO entry:** Click "Edit" on an entry → opens `OooForm` in edit mode
- **Remove OoO entry:** Click "Remove" → immediate soft-delete (no confirmation, consistent with current behavior)

### Role scoping

- **Owner:** Sees all therapist cards. Can add/edit/remove OoO on any card. The OoO form's therapist picker is hidden (locked to card's therapist).
- **Therapist:** Sees only their own card. Can manage their own OoO entries.

### What gets removed

- The entire "Out of Office" section in `schedule-page.tsx` (lines 132-185): heading, broken filter Select, OooList, OooForm trigger
- The `oooTherapistFilter` state variable
- The `oooTherapistId` derived value

### Components

**Modified:**
- `schedule-card.tsx` — gains OoO sub-section. Accepts new props: `oooEntries` (pre-fetched array) + `onAddOoo` callback + `onEditOoo(id)` callback + `onRemoveOoo(id)` callback
- `schedule-page.tsx` — removes standalone OoO section. Fetches OoO per therapist (or fetches all for venue and groups client-side). Manages OooForm state per card.

**Unchanged:**
- `ooo-form.tsx` — Dialog works as-is, just triggered from the card now
- `ooo-list.tsx` — can be deleted (its rendering logic moves into schedule-card, simplified)

**Deleted:**
- `ooo-list.tsx` — functionality absorbed into schedule-card

### Data fetching strategy

Two options for getting OoO data into cards:

**Option A (chosen): Single query, client-side grouping.** `schedule-page.tsx` queries all OoO for therapists who have schedules at this venue (using `listByTherapist` per therapist, or a batch approach). Groups by therapistId, passes relevant entries to each card.

In practice: since we already query `therapists` (listTherapistsByOrg) and `schedules` (listByVenue), we add one `useQuery` per displayed therapist for their OoO. This matches the existing pattern where each `ScheduleCard` already calls `useQuery(users.getPublic, { id: schedule.therapistId })` internally.

**Decision:** Each `ScheduleCard` queries its own OoO internally (same pattern as it already queries the therapist name). This keeps the card self-contained and avoids prop-drilling arrays.

### Forward-compatibility with #33 (Calendar views)

- OoO data model stays unchanged (`ooo` table, `expandOooToDateRanges` helper)
- Calendar view (#33) will query `ooo.listByTherapistAndDateRange` independently for its overlays
- No shared state between Schedule tab and Calendar tab — each owns its own queries
- The card's OoO display is read-from-same-source, not a cache or derived state

## Files Changed

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/admin/components/schedule-card.tsx` | Rewrite | Card with inline OoO entries + Add/Edit/Remove |
| `apps/admin/components/schedule-page.tsx` | Modify | Remove standalone OoO section, manage OooForm state triggered by cards |
| `apps/admin/components/ooo-list.tsx` | Delete | Absorbed into schedule-card |

## Out of Scope

- Calendar views (#33) — separate spec
- OoO overlap detection (existing booking-overlap warning in OooForm stays)
- Bulk OoO management
- OoO notifications to customers
