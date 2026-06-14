# Customer Booking UI Design Spec

## Overview

A customer-facing booking interface for openschedule that allows end-users to book therapy sessions at a venue. The UI lives in `apps/web` and follows a route-per-step architecture within Next.js 16 App Router.

The booking flow: select therapist → pick date/time → fill form → confirm.

## Architecture

**Layout:** Two-column on desktop (left: running summary of selections, right: active step content). On mobile, collapses to single column with a sticky bar showing current selections.

**Routing:** Each step is its own route under `/:orgSlug/:venueSlug/`. URL is the single source of truth for state — no client-side state machine.

**Data:** Almost entirely reactive via Convex `useQuery` on the client. Server components handle param validation, layout, and SEO metadata. Client components own the interactive UI and real-time data.

## Route Structure

```
app/
  [orgSlug]/
    [venueSlug]/
      (booking)/
        layout.tsx        — two-column shell (left summary, right children)
        page.tsx          — therapist selection grid
        book/
          [therapistId]/
            page.tsx      — calendar + time slot picker
            confirm/
              page.tsx    — booking form (date/time from search params)
      bookings/
        [bookingId]/
          page.tsx        — standalone confirmation & cancellation page
```

The `(booking)` route group applies the two-column layout to the booking flow steps only. `bookings/[bookingId]` sits outside this group and renders as a standalone page without the summary panel.

## URL as State

| URL | State |
|-----|-------|
| `/:org/:venue` | Nothing selected |
| `/:org/:venue/book/any` | Wildcard therapist chosen |
| `/:org/:venue/book/:therapistId` | Specific therapist chosen |
| `/:org/:venue/book/:therapistId/confirm?date=2025-06-20&time=09:00` | Date + time chosen |
| `/:org/:venue/bookings/:bookingId` | Booking complete |

Back button works at every step. No client state to lose on refresh.

## Component Breakdown

### Shared Layout (`[venueSlug]/layout.tsx`)

- `BookingLayout` — two-column shell
- `BookingSummary` — left panel, reads route params + search params, shows accumulated selections (venue, therapist, date, time). Uses Convex `useQuery` to resolve therapist name/photo from ID.

On mobile: summary collapses to a sticky bar (e.g., "Dr. Smith · Jun 20 · 9:00 AM").

### Step 1: Therapist Selection (`[venueSlug]/page.tsx`)

- `TherapistGrid` — responsive grid of `TherapistCard` components
- `TherapistCard` — displays therapist photo + name. Accepts an `isWildcard` prop (or similar) to render the "?" variant with "Any available" label. Clicking navigates to `/book/:therapistId` or `/book/any`.

Data: fetches therapists with active schedules at this venue via Convex reactive query.

### Step 2: Date & Time (`book/[therapistId]/page.tsx`)

Layout within the right panel:
1. `TherapistHeader` — name + photo of selected therapist (or "Any available" for wildcard)
2. `DateTimePicker` — horizontal split: calendar left, time slots right

Components:
- `AvailabilityCalendar` — react-day-picker month grid. Green dots on dates with available slots. Greyed-out and unclickable for dates with no availability. Only renders dates within the therapist's availability horizon.
- `TimeSlotList` — scrollable list of time slot buttons for the selected date. Clicking a slot navigates to the confirm page.

Data: `availability.getSlots` (or `getSlotsForAllTherapists` for "any") via Convex reactive `useQuery`. Slots update in real-time as others book.

### Step 3: Booking Form (`book/[therapistId]/confirm/page.tsx`)

- `BookingForm` — collects: name (required), email (required), phone (required), notes (optional)
- `BookingSummaryCard` — recap of date, time, therapist, venue

For the "any" flow: resolves which therapist is assigned (random from available for that slot) and displays "You'll be seeing [Name]" before submission.

Validation: client-side with zod (email format, phone format, required fields). Server-side validation in the Convex mutation as well.

Submit calls `bookings.create` mutation → on success, `router.push` to `/bookings/:bookingId`.

### Post-Booking (`bookings/[bookingId]/page.tsx`)

- `BookingConfirmation` — full booking details (date, time, therapist, venue, status)
- Status badge (pending/confirmed/cancelled)
- Cancel button (available to customer)
- Reactive: reflects status changes in real-time (e.g., therapist confirms)

Standalone page — no two-column layout.

## Reactivity Model

All interactive components use Convex `useQuery` for real-time data:

| Component | Query | Why Reactive |
|-----------|-------|-------------|
| `BookingSummary` | therapist/venue details | Name/photo could update |
| `TherapistGrid` | therapists at venue | New therapists appear live |
| `AvailabilityCalendar` | `availability.getSlots` | Dots update as slots fill |
| `TimeSlotList` | same query, filtered to date | Slots disappear in real-time |
| `BookingForm` | slot availability check | Warn if slot taken mid-fill |
| `BookingConfirmation` | `bookings.get` | Status changes reflect immediately |

Server components handle:
- Param validation (does this org/venue/therapist exist?)
- SEO metadata (page title, OG tags)
- Layout structure and rendering client components

## Navigation

- Therapist card click → `router.push('/book/:id')`
- Time slot click → `router.push('/book/:id/confirm?date=...&time=...')`
- Form submit → mutation → `router.push('/bookings/:bookingId')`
- Browser back works at every step (URL is state)

## Mobile Behavior

Breakpoint: `md` (768px).

- Below `md`: single column. `BookingSummary` becomes a sticky bar at the top showing current selections in one condensed line.
- Calendar and time slots stack vertically (calendar above, slots below).
- Everything else flows naturally as single column.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Slot taken during form fill | Reactive query detects change → toast "This time is no longer available" → redirect to time picker |
| Invalid therapist ID in URL | "Therapist not found" message + link back to therapist selection |
| No availability at all | Calendar shows all dates greyed out + "No availability in the next X days" message |
| Venue or org not found | 404 page |
| Form validation failure | Inline field errors (zod) |
| Double submit | Button disabled on submit + mutation conflict detection |

## Styling

- Tailwind v4 + shadcn components from `packages/ui`
- Clean, minimal aesthetic — white/neutral backgrounds, clear visual hierarchy
- Green dots on calendar for available days
- Therapist cards with subtle borders
- Time slots as pill-shaped buttons (compact, scannable)
- Loading: skeleton states for every async component
- No custom design system — shadcn defaults with green accent for availability indicators

## Required shadcn Components

These need to be added to `packages/ui` (only `Button` exists currently):

- `Card` — therapist cards, summary card
- `Input` — form fields
- `Label` — form labels
- `Badge` — booking status
- `Avatar` — therapist photos
- `Skeleton` — loading states
- `Calendar` (react-day-picker based) — availability calendar

## Dependencies to Add

- `react-day-picker` — date picker grid for `AvailabilityCalendar`
- `date-fns` — date formatting for display (already in convex package, may need in web)
- `zod` — form validation (already available via `packages/ui`)
- `sonner` or similar — toast notifications for error states

## Out of Scope

- Admin/onboarding flow (separate brainstorm cycle)
- Authentication (customer side has no auth)
- Email notifications (handled separately)
- Google Calendar integration
- Payment/pricing
