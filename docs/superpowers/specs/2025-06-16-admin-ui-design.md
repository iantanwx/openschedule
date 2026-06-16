# Admin UI — Phase 1 Design Spec

## Overview

Build out the admin app's core operational features: a today-focused dashboard, bookings management, schedule management, and venue settings. Mobile-first design with bottom tab navigation.

**Phasing:**
- **Phase 1 (this spec):** Dashboard (today view), bookings list + management (including reschedule), schedule management, venue settings
- **Phase 2 (future):** Therapist invitations, blockout management, org settings, Google Calendar integration

## Navigation

Bottom tab bar with 4 tabs:

| Tab | Label | Icon | Purpose |
|-----|-------|------|---------|
| 1 | Today | Calendar | Default landing — time-grid day view |
| 2 | Bookings | List | Full booking list with filters |
| 3 | Schedule | Clock | Per-therapist schedule cards |
| 4 | Settings | Gear | Venue config, account |

**Top bar:** Org name (left) + user avatar (right, tap for account menu/sign-out).

**Venue context:** If multi-venue, a chip/dropdown above the content area. For single-venue orgs (the common case), this is hidden — venue is implicit.

**Responsive behavior:**
- Primary viewport: 375px (phone)
- Tabs remain at bottom on all screen sizes
- Content area expands naturally on tablet/desktop (wider timeline, wider cards)
- Breakpoint at `md` (768px): timeline can show multiple therapist columns side by side

## Role Scoping

| Feature | Owner | Therapist |
|---------|-------|-----------|
| Today tab | All bookings at venue | Own bookings only |
| Bookings tab | All bookings, filter by therapist | Own bookings (therapist filter hidden) |
| Bookings — create on behalf | Yes (including over-capacity) | Yes (within capacity) |
| Bookings — confirm/cancel | Any booking | Own bookings |
| Bookings — reschedule | Any booking | Own bookings |
| Schedule tab | All therapists' schedules | Own schedule only |
| Schedule — edit | Any therapist | Own only |
| Settings — venue | Full edit + archive | Read-only |
| Settings — org | Edit | Hidden |
| Settings — account | Sign out | Sign out |

## Tab 1: Today (Default Landing)

### Layout
- Quick stats banner: "N bookings · X confirmed · Y pending · Z completed"
- Time-grid timeline filling the remaining height
- FAB (floating action button) bottom-right for "New Booking"

### Time-grid Timeline
- Vertical axis: venue working hours (`dayStart` → `dayEnd`)
- Hour markers on the left edge (08:00, 09:00, 10:00, ...)
- Bookings rendered as positioned blocks:
  - Top offset = (startTime - dayStart) / (dayEnd - dayStart) * 100%
  - Height = duration / (dayEnd - dayStart) * 100%
- Each block shows: time range + customer name + therapist name (owner view) or customer name only (therapist view)
- Color-coded by status:
  - Confirmed: green (`bg-emerald-100 border-emerald-300`)
  - Pending: amber (`bg-amber-100 border-amber-300`)
  - Cancelled: grey, lower opacity
- Tap a block → opens booking detail modal

### Booking Detail Modal
- Shows: customer name, email, phone, therapist name, date, time, status, createdBy
- Actions (contextual by status):
  - Pending: Confirm | Cancel | Reschedule
  - Confirmed: Cancel | Reschedule
  - Cancelled: (read-only, no actions)

### Reschedule Flow (within modal)
1. Tap "Reschedule" → modal transitions to a date + time picker view
2. Date picker: calendar showing available dates for that therapist
3. Time slots: available slots on selected date
4. Confirm → calls `bookings.reschedule` mutation
5. Modal closes, timeline re-renders reactively

### FAB — New Booking
1. Tap FAB → opens a creation sheet/modal
2. Steps: pick therapist → pick date → pick available slot → enter customer info (name, email, phone, optional notes)
3. Submit → calls `customers.getOrCreate` then `bookings.create` with `createdBy: "owner"` or `"therapist"`
4. On success: toast + sheet closes, timeline updates reactively

### Day Navigation
- Swipe left/right or arrow buttons to move between days
- Date displayed in the stats banner area (e.g., "Mon, Jun 16")

## Tab 2: Bookings

### Layout
- Filter bar at top: date range picker, status filter (all/pending/confirmed/cancelled), therapist filter (owner only)
- Scrollable list of booking cards sorted by date descending
- FAB for "New Booking" (same flow as Today tab)

### Booking Card
- Date + time range
- Customer name
- Therapist name (owner view)
- Status badge
- Tap → same booking detail modal

### Filters
- Date range: defaults to "next 7 days"
- Status: toggle chips (all | pending | confirmed | cancelled)
- Therapist: dropdown (owner only, hidden for therapist role)
- All filtering done client-side via Convex reactive queries

## Tab 3: Schedule

### Layout
- List of therapist cards (one per therapist with a schedule at this venue)
- Owner sees all; therapist sees only their own card
- Empty state if no schedules: "No schedules configured. Add a schedule to start accepting bookings."

### Therapist Schedule Card
- Therapist name
- Working days as chips (Mon, Tue, Wed, ...)
- Hours: "09:00 – 17:00"
- Slot duration: "60 min"
- Availability horizon: "14 days"
- Tap → edit form

### Edit Form (modal or page)
- Day toggles: checkboxes for each day of the week
- Start time: time picker
- End time: time picker
- Slot duration: dropdown (30, 45, 60, 90, 120 minutes)
- Availability horizon: number input (days)
- Save → calls `schedules.upsert`
- Delete schedule → calls `schedules.remove` (owner only)

## Tab 4: Settings

### Venue Section (owner: editable, therapist: read-only)
- Name (text input)
- Slug (text input, read-only display)
- Timezone (dropdown)
- Capacity (number input)
- Day start / Day end (time pickers)
- Archive button (owner only, with confirmation)

### Org Section (owner only)
- Org name
- Org slug (read-only)

### Account Section
- User name + email (read-only)
- Sign out button

## New Backend: `reschedule` Mutation

**File:** `packages/convex/src/mutations/bookings.ts`

**Signature:**
```typescript
export const reschedule = mutation({
  args: {
    id: v.id("bookings"),
    newDate: v.string(),
    newStartTime: v.string(),
    newEndTime: v.string(),
  },
  handler: async (ctx, args) => { ... },
});
```

**Logic:**
1. Auth guard: requires authenticated user (owner or therapist)
2. Fetch existing booking — must not be cancelled
3. If therapist role: assert booking.therapistId matches current user
4. Validate new slot: check therapist isn't double-booked at new time
5. Validate capacity: check venue isn't at capacity for new time (unless overCapacity was set on original)
6. Patch booking: update `date`, `startTime`, `endTime`
7. Keep all other fields (customerId, therapistId, status, createdBy, overCapacity)

**Design decision:** Reschedule is a patch, not cancel+create. This preserves the booking ID, creation timestamp, and avoids edge cases where the cancel succeeds but re-create fails.

## Routing Structure

```
apps/admin/app/(protected)/[orgSlug]/
  (tabs)/
    layout.tsx              — tab bar shell + top bar
    page.tsx                — Today (time-grid timeline)
    bookings/page.tsx       — Bookings list
    schedule/page.tsx       — Schedule cards
    settings/page.tsx       — Settings
```

Each page is a thin server component that passes params to a `"use client"` wrapper component. The wrapper resolves org/venue via `useQuery` and renders the interactive content.

## Convex Queries Needed

Existing queries that will be used:
- `venues.listByOrg` / `venues.get` — venue context
- `bookings.listByVenueAndDate` — Today tab
- `bookings.listByVenueDateRange` — Bookings tab
- `bookings.listByTherapistAndDateRange` — therapist-scoped view
- `bookings.get` — booking detail
- `schedules.listByVenue` — Schedule tab
- `users.listByVenue` — therapist list for filters
- `availability.getSlots` — reschedule slot picker

New queries needed:
- `bookings.listByVenueAndDateForAdmin` — returns bookings with customer name included (join customer data). Or we fetch customers separately.

**Decision:** Keep queries lean — fetch bookings, then batch-fetch customer names client-side with individual `customers.get` calls. Convex caches these efficiently.

## Component Breakdown

| Component | Responsibility |
|-----------|---------------|
| `TabBar` | Bottom navigation, active state, routing |
| `TopBar` | Org name, avatar, optional venue selector |
| `TimeGrid` | Day timeline rendering, hour markers, block positioning |
| `BookingBlock` | Single booking rendered on the time grid |
| `BookingDetailModal` | Booking info + action buttons |
| `RescheduleView` | Date picker + slot list within the modal |
| `NewBookingSheet` | FAB-triggered creation flow |
| `BookingList` | Filterable card list for Bookings tab |
| `BookingCard` | Single booking card in list |
| `FilterBar` | Date range + status + therapist filters |
| `ScheduleCard` | Therapist schedule summary |
| `ScheduleEditForm` | Day toggles, time pickers, slot duration |
| `VenueSettingsForm` | Venue edit form |
| `DayNav` | Left/right arrows + date display for Today tab |

## Out of Scope (Phase 2)

- Therapist invitations (owner invites via email)
- Blockout management UI
- Org-level settings (beyond name)
- Google Calendar integration UI
- Drag-and-drop rescheduling (progressive enhancement)
- Push notifications
- Email notifications on booking changes
