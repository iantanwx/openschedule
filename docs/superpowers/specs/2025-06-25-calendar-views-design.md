# Calendar Views Design

## Overview

Replace the custom single-day time grid with a full calendar system powered by `@schedule-x/react`. Five views: Day, 3-Day, Week, Month, Schedule. URL-persisted state. Rename the "Today" venue tab to "Calendar".

## Views

| View | Layout | Event display |
|------|--------|--------------|
| Day | Single-column time grid | Full booking blocks + OoO blocks |
| 3-Day | 3-column time grid | Full booking blocks + OoO blocks |
| Week | 7-column time grid with day headers | Full booking blocks + OoO blocks |
| Month | Date cell grid | Booking count dots, OoO background indicator. Click date → Day view |
| Schedule | Chronological agenda grouped by day | List items (no time grid) |

Default view: Day.

## Library

`@schedule-x/react` — handles time grid rendering, multi-day columns, event positioning, drag (future). We provide custom event render components for our styling.

## URL State

```
?view=day|3day|week|month|schedule&date=YYYY-MM-DD
```

- `view` defaults to `day` if absent
- `date` defaults to today if absent
- Navigation (arrows, "Today" button, month-cell click) updates both params via `router.replace`

## Tab Rename

- `lib/nav/venue-tabs.ts`: change first item from `label: "Today"` to `label: "Calendar"`
- `tab-bar.tsx`: same rename applies (it reads from venue-tabs)

## Events

Two event types fed to the calendar:

### Bookings
- Color: green (confirmed), amber (pending)
- Display: customer name, therapist name, time range
- Click: opens `BookingDetailModal`
- Source: `bookings.listByVenueAndDate` (day) or `bookings.listByVenueDateRange` (3-day/week/month/schedule)

### OoO (Out of Office)
- Color: indigo/blue (distinct from booking greens/ambers)
- Style: dashed border or striped pattern to differentiate from bookings
- Display: therapist name + reason (if present)
- Click: no action (informational)
- Source: `ooo.listByTherapistAndDateRange` per visible therapist for the date window

## Toolbar

### Desktop (md+)
```
[←] [→] [Today]   Wed, Jun 25, 2025   [Day | 3-Day | Week | Month | Schedule]
```

- Left: prev/next arrows + "Today" button (resets date to today)
- Center: formatted date/range display
- Right: segmented control (5 options)

### Mobile (<md)
```
[←] Jun 25 [→]   [Today] [▼ Day]
```

- Left: arrows + compact date
- Right: "Today" button + `<Select>` dropdown for view

## Data Fetching

No new backend queries needed.

| View | Query | Args |
|------|-------|------|
| Day | `bookings.listByVenueAndDate` | `{ venueId, date }` |
| 3-Day | `bookings.listByVenueDateRange` | `{ venueId, startDate, endDate }` (3-day window) |
| Week | `bookings.listByVenueDateRange` | `{ venueId, startDate, endDate }` (7-day window) |
| Month | `bookings.listByVenueDateRange` | `{ venueId, startDate, endDate }` (full month) |
| Schedule | `bookings.listByVenueDateRange` | `{ venueId, startDate, endDate }` (14-day rolling) |

OoO for all views: `ooo.listByTherapistAndDateRange` with the same date window, per therapist (or all therapists for owner in "All" mode).

## Existing Features Preserved

- **Therapist filter:** Owner gets My/All toggle + therapist dropdown (filters events client-side)
- **FAB:** New booking button, positioned bottom-right (all views)
- **BookingDetailModal:** Opens on booking event click
- **Role scoping:** Therapist in "My" mode sees only own bookings/OoO
- **View toggle:** My/All for therapists who are owners

## Component Architecture

```
calendar-page.tsx (replaces today-page.tsx)
├── calendar-toolbar.tsx (arrows + date + Today + view switcher)
├── calendar-view.tsx (schedule-x wrapper)
│   ├── booking-event.tsx (custom render for booking events)
│   └── ooo-event.tsx (custom render for OoO events)
├── BookingDetailModal (existing, unchanged)
└── Fab (existing, unchanged)
```

## Files to Delete

- `today-page.tsx` (replaced by `calendar-page.tsx`)
- `time-grid.tsx` (replaced by schedule-x)
- `day-nav.tsx` (replaced by `calendar-toolbar.tsx`)
- `booking-block.tsx` (replaced by `booking-event.tsx`)

## Files to Modify

- `lib/nav/venue-tabs.ts`: "Today" → "Calendar"
- `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`: import CalendarPage instead of TodayPage
- `apps/admin/lib/convex-api.ts`: ensure `ooo.listByTherapistAndDateRange` is typed (may already be)

## Out of Scope

- Drag-and-drop rescheduling (future enhancement)
- Recurring events
- Multi-resource/room view
- Print view
