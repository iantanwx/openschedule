# OpenSchedule — Design Spec

## Overview

OpenSchedule is a multi-tenant appointment booking platform for physical therapy studios. Customers book massage/therapy sessions through a public-facing web app. Therapists and studio owners manage schedules, bookings, and availability through a separate admin app.

## Architecture

### Monorepo Structure

```
openschedule/
├── apps/
│   ├── web/          # Customer-facing Next.js 16 app
│   └── admin/        # Admin Next.js 16 app (therapist/owner dashboard)
├── packages/
│   ├── convex/       # Backend: schema, functions, auth
│   ├── ui/           # Shared UI components (shadcn/radix-nova, Tailwind v4)
│   └── typescript-config/  # Shared TS configs
```

### Deployment

- **Customer app:** `openschedule.com/:orgSlug/:venueSlug/...` — Vercel
- **Admin app:** `admin.openschedule.com/:orgSlug/...` — Vercel (separate project)
- **Backend:** Convex (hosted, reactive queries, transactional mutations, scheduled functions)

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Backend:** Convex (schema, queries, mutations, actions, scheduled functions)
- **Auth (admin):** better-auth with Convex adapter
- **UI:** shadcn/radix-nova, Tailwind v4
- **Calendar UI:** react-day-picker + custom time slot components (separate brainstorm)
- **Linting/Formatting:** oxlint, oxfmt
- **Language:** TypeScript 5 (strict)
- **Package Manager:** pnpm with workspaces
- **Build:** Turborepo

## Domain Model

### Entities

#### Organization

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| name | string | Display name |
| slug | string | URL-safe, unique |

#### Venue

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| orgId | Id → Organization | FK |
| name | string | Display name |
| slug | string | Unique within org |
| timezone | string | IANA timezone (e.g., "America/New_York") |
| capacity | number | Bed count (fungible) |
| dayStart | string | Venue operating start (e.g., "07:00") |
| dayEnd | string | Venue operating end (e.g., "21:00") |

#### User (via better-auth)

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| email | string | Unique |
| name | string | Display name |
| role | "owner" \| "therapist" | Permissions level |
| orgId | Id → Organization | FK |

#### Schedule

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| therapistId | Id → User | FK |
| venueId | Id → Venue | FK |
| workingDays | number[] | 0=Sun through 6=Sat |
| startTime | string | e.g., "09:00" |
| endTime | string | e.g., "17:00" |
| slotDuration | number | Minutes (uniform per therapist) |
| availabilityHorizonDays | number | How far ahead to show availability |

One schedule per therapist per venue.

#### Blockout

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| therapistId | Id → User | FK (global — not venue-scoped) |
| date | string | ISO date (YYYY-MM-DD) |
| startTime | string | e.g., "10:00" |
| endTime | string | e.g., "14:00" |
| reason | string? | Optional explanation |

Blockouts apply globally to the therapist across all venues.

#### Customer

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| orgId | Id → Organization | FK |
| email | string | Unique per org |
| name | string | Display name |
| phone | string? | Optional |

Customers are org-scoped — they can book at any venue within the org.

#### Booking

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| venueId | Id → Venue | FK |
| therapistId | Id → User | FK |
| customerId | Id → Customer | FK |
| date | string | ISO date (YYYY-MM-DD) |
| startTime | string | e.g., "09:00" |
| endTime | string | e.g., "09:50" |
| status | "pending" \| "confirmed" \| "cancelled" | Lifecycle state |
| createdBy | "customer" \| "therapist" \| "owner" | Who initiated |
| overCapacity | boolean | Whether this exceeds venue capacity |

#### Settings

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| scope | "org" \| "user" \| "venue" | Polymorphic scope |
| scopeId | Id | FK to org/user/venue |
| version | number | Schema version for migration |
| data | object | JSON config blob |

#### Integration

| Field | Type | Notes |
|-------|------|-------|
| id | Id | Auto-generated |
| scope | "user" | Per-therapist for MVP |
| scopeId | Id → User | FK |
| provider | "google-calendar" | Integration type |
| version | number | Schema version |
| config | object | Credentials/tokens (encrypted) |
| enabled | boolean | Active flag |

### Relationships

- Organization 1 → N Venues, Users, Customers
- Venue 1 → N Schedules, Bookings
- User (therapist) 1 → N Schedules (per venue), Blockouts (global), Bookings, Integrations
- Customer 1 → N Bookings (across any venue in org)

### Computed (Not Stored)

**Available Slots** = Schedule template − Blockouts − Existing bookings − Capacity constraint

- Computed on-the-fly via Convex queries
- Capped by `availabilityHorizonDays` per therapist
- Max render window: 31 days
- Convex reactivity ensures real-time updates (no polling)

## Customer App (`apps/web`)

### Routes

| Route | Purpose |
|-------|---------|
| `/:orgSlug/:venueSlug` | Venue landing — therapist list + "any available" |
| `/:orgSlug/:venueSlug/book` | Slot picker + booking form |
| `/:orgSlug/:venueSlug/bookings/:bookingId` | Booking status page |
| `/:orgSlug/:venueSlug/bookings/:bookingId/cancel` | Cancellation page |

### Booking Flow

1. Customer lands on venue page, sees list of therapists + "any available" option
2. Picks a therapist (or "any available")
3. Date picker shows available dates (days with at least one free slot)
4. Picks a date → time slots render for that date
5. Picks a time → booking form appears (name, email, phone)
6. Submits → booking created with status `pending`
7. Confirmation email sent with link
8. Customer clicks link → status flips to `confirmed`
9. Confirmation email sent with `.ics` attachment + "Add to Google Calendar" link

**"Any available" logic:** Shows union of all therapists' availability at the venue. On confirm, system randomly assigns an available therapist for that slot.

**State machine:** `selecting_date → selecting_time → booking → pending_confirmation`

### Calendar/Booking UI

This is complex enough to warrant its own brainstorm → plan → implementation cycle.

Key decisions already made:
- `react-day-picker` for the date grid (accessibility, keyboard nav, locale handling)
- Custom time slot list component
- Slots data shape: `Record<string, TimeSlot[]>` (date string → array of available times)
- Convex reactive queries provide real-time slot availability

## Admin App (`apps/admin`)

### Routes

| Route | Purpose |
|-------|---------|
| `/:orgSlug` | Dashboard — single pane of glass (all venues, all bookings) |
| `/:orgSlug/venues/:venueSlug` | Venue-specific view |
| `/:orgSlug/venues/:venueSlug/bookings` | Venue bookings list |
| `/:orgSlug/venues/:venueSlug/schedule` | Schedule management per therapist |
| `/:orgSlug/blockouts` | Therapist blockout management |
| `/:orgSlug/therapists` | User management (owner only) |
| `/:orgSlug/settings` | Org settings |
| `/:orgSlug/integrations` | Google Calendar integration |

### Permissions

**Owner:**
- Manage venues (create, edit capacity, working hours)
- Invite therapists to the org
- View all bookings across venues (filterable by therapist, date, venue)
- Create bookings on behalf of customers (including over-capacity with warning)
- Manage org settings

**Therapist:**
- View own bookings (per venue)
- Manage own schedule (working days/hours/slot duration per venue)
- Manage own blockouts
- Create bookings on behalf of customers (within capacity)
- Manage own integrations (Google Calendar)

## Notifications & Integrations

### Emails (via Convex scheduled functions)

| Trigger | Recipients | Content |
|---------|-----------|---------|
| Booking created | Customer | Confirmation link |
| Booking confirmed | Customer | `.ics` attachment + "Add to Calendar" link |
| Booking confirmed | Therapist | New booking notification |
| Booking cancelled | Customer + Therapist | Cancellation notice |

### Google Calendar (therapist-side, OAuth)

- Credentials stored in Integration table (per-user scope)
- On booking confirmed → create calendar event via Google Calendar API
- On booking cancelled → delete/cancel calendar event
- Implemented as Convex actions (async, external API calls)

### Customer Calendar (no OAuth needed)

- `.ics` file attachment in confirmation email (works with any calendar app)
- "Add to Google Calendar" URL (query-param-based link, zero integration)

## Business Rules

1. **Capacity:** Simple counter on Venue (beds are fungible, no assignment)
2. **Over-capacity:** Only owner can create. Booking gets `overCapacity: true`. UI shows warning before confirm.
3. **"Any available":** Union of all therapists' availability at venue. Random assignment on confirm.
4. **Blockouts:** Global to therapist (not venue-scoped). A blocked therapist is unavailable everywhere.
5. **Customers:** Org-scoped. Can book at any venue in the org. Unique email per org.
6. **Cancellation:** Both customer and therapist can cancel. Status → `cancelled`.
7. **Slot computation:** Reactive via Convex queries. No polling, no stale data.
8. **Max availability window:** 31 days ahead.
9. **Confirmation:** Email-based. Booking starts as `pending`, flips to `confirmed` on link click.

## Out of Scope (MVP)

- Customer accounts/authentication
- Custom domains for venues
- Recurring bookings
- Multi-slot bookings
- Bed assignment (beds stay fungible)
- Appointment reminders (pre-appointment notifications)
- Payment processing
- SMS notifications
- Waitlists

## Separate Brainstorm Required

The **calendar/booking UI** (react-day-picker + custom time slot selection + booking state machine) requires its own brainstorm → plan → implementation cycle due to its visual and interaction complexity.
