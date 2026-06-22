# Email Templates Design

## Problem

All transactional emails are plain text — no branding, no structure, no visual hierarchy. The booking confirmation email lacks an "Add to Calendar" link and `.ics` attachment that the original design spec requires.

## Decisions

- **Style:** Minimal Fresha-inspired, shadcn-consistent (zinc neutral palette, clean borders, structured details card)
- **Scope:** All 4 email types get HTML templates (booking created, cancelled, rescheduled, invitation)
- **Technology:** React Email (`@react-email/components`) in a shared `packages/emails/` package
- **Calendar:** `.ics` file attachment + "Add to Google Calendar" button link on booking created + rescheduled
- **Map:** Google Static Maps image (480x140) with "Get directions" link, shown when venue has coordinates

## Architecture

### Package: `packages/emails/`

New workspace package `@openschedule/emails`. Dependencies: `@react-email/components`, `@react-email/render`, `react`.

```
packages/emails/
├── package.json
├── tsconfig.json
├── src/
│   ├── components/
│   │   ├── email-layout.tsx       wrapper: header + body + footer
│   │   ├── details-card.tsx       key-value table on muted bg
│   │   ├── static-map.tsx         Google Static Maps <Img> + directions link
│   │   ├── email-button.tsx       primary + secondary button styles
│   │   └── status-badge.tsx       colored pill (confirmed/cancelled/rescheduled)
│   ├── templates/
│   │   ├── booking-created.tsx    confirmed booking (customer-facing)
│   │   ├── booking-cancelled.tsx  cancellation notice
│   │   ├── booking-rescheduled.tsx new time notice
│   │   └── invitation.tsx         team invitation
│   ├── lib/
│   │   ├── ics.ts                 generates VCALENDAR string
│   │   └── calendar-url.ts       builds Google Calendar event URL
│   └── index.ts                   re-exports render + templates + lib
```

### Shared Components

**`email-layout.tsx`** — wraps all templates:
- Dark header bar (zinc-950) with business name text (or "OpenSchedule" for invitations)
- White body container with zinc-200 border
- Light footer with attribution line
- Props: `{ orgName: string; children: ReactNode }`

**`details-card.tsx`** — key-value details:
- Muted background (zinc-50), rounded border
- Table of label → value rows
- Props: `{ items: Array<{ label: string; value: string }> }`

**`static-map.tsx`** — conditional map section:
- Google Static Maps API image URL (480x140, zoom 15, single marker)
- Below: address text + "Get directions →" link (Google Maps URL using placeId or coordinates)
- Props: `{ coordinates: { lat: number; lng: number }; address: string; placeId?: string; apiKey: string }`
- Renders nothing if coordinates are null/undefined

**`email-button.tsx`** — CTA buttons:
- Primary: zinc-950 bg, white text, rounded
- Secondary: white bg, zinc-950 text, zinc-200 border
- Props: `{ href: string; variant?: "primary" | "secondary"; children: ReactNode }`

**`status-badge.tsx`** — colored pill:
- Confirmed = green (dcfce7 bg, 166534 text)
- Cancelled = red (fef2f2 bg, 991b1b text)
- Rescheduled = blue (eff6ff bg, 1e40af text)
- Props: `{ status: "confirmed" | "cancelled" | "rescheduled" }`

### Templates

#### `booking-created.tsx`

Recipients: customer only.

Props:
```ts
interface BookingCreatedProps {
  customerName: string;
  orgName: string;
  serviceName: string;
  date: string;           // formatted: "Monday, June 23, 2025"
  time: string;           // formatted: "9:00 AM – 10:30 AM"
  therapistName: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  placeId?: string;
  viewUrl: string;
  cancelUrl: string;
  calendarUrl: string;    // Google Calendar event URL
  googleMapsApiKey?: string;
}
```

Content:
- Status badge: "Confirmed" (green)
- Headline: "Your booking is confirmed"
- Subheading: "Hi {name}, here are your appointment details."
- Details card: Service, Date, Time, Therapist, Location
- Static map (if coordinates present)
- CTAs: "View Booking" (primary) + "Add to Calendar" (secondary)
- Cancel link (subtle text)
- Attachment: `.ics` file (generated separately, not part of the React component)

#### `booking-cancelled.tsx`

Recipients: customer + therapist.

Props:
```ts
interface BookingCancelledProps {
  recipientName: string;
  orgName: string;
  serviceName: string;
  date: string;
  time: string;
  therapistName: string;
  rebookUrl: string;      // venue landing page URL
}
```

Content:
- Status badge: "Cancelled" (red)
- Headline: "Your booking has been cancelled"
- Details card: Service, Date, Time, Therapist (no location — not needed)
- CTA: "Book Again" (primary, links to venue page)
- No map, no .ics, no cancel link

#### `booking-rescheduled.tsx`

Recipients: customer + therapist.

Props:
```ts
interface BookingRescheduledProps {
  recipientName: string;
  orgName: string;
  serviceName: string;
  date: string;           // new date
  time: string;           // new time
  therapistName: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  placeId?: string;
  viewUrl: string;
  cancelUrl: string;
  calendarUrl: string;
  googleMapsApiKey?: string;
}
```

Content:
- Status badge: "Rescheduled" (blue)
- Headline: "Your booking has been rescheduled"
- Subheading: "Hi {name}, your appointment has moved to a new time."
- Details card: Service, New Date, New Time, Therapist, Location
- Static map (if coordinates)
- CTAs: "View Booking" (primary) + "Add to Calendar" (secondary)
- Cancel link
- Attachment: updated `.ics`

#### `invitation.tsx`

Recipients: invited email.

Props:
```ts
interface InvitationProps {
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
}
```

Content:
- Header shows "OpenSchedule" (not org name — recipient isn't a member yet)
- Headline: "You've been invited to join a team"
- Body text: "{inviterName} has invited you to join {orgName} on OpenSchedule."
- Details card: Organization, Invited by, Role (Therapist)
- CTA: "Accept Invitation" (primary)
- Footer note: "If you don't have an account, you'll be prompted to create one."
- No map, no .ics, no cancel link

### `.ics` Generation (`lib/ics.ts`)

Generates a VCALENDAR/VEVENT string:

```ts
interface IcsEventData {
  summary: string;        // "Deep Tissue Massage — Serenity Wellness Studio"
  startDate: string;      // ISO: "2025-06-23T09:00:00"
  endDate: string;        // ISO: "2025-06-23T10:30:00"
  timezone: string;       // "America/New_York"
  location?: string;      // venue address
  description?: string;   // "Therapist: Jane Smith\nService: Deep Tissue Massage"
  organizer?: string;     // org email or from address
}

function generateIcs(data: IcsEventData): string
```

Returns a valid `.ics` string (RFC 5545). No external library needed — the format is simple enough to generate manually.

### Google Calendar URL (`lib/calendar-url.ts`)

Builds a `https://calendar.google.com/calendar/render?action=TEMPLATE&...` URL:

```ts
interface CalendarUrlData {
  title: string;
  startDate: string;      // "20250623T090000"
  endDate: string;        // "20250623T103000"
  timezone: string;
  location?: string;
  description?: string;
}

function buildGoogleCalendarUrl(data: CalendarUrlData): string
```

### Changes to `sendEmail` Helper

Upgrade `EmailPayload` to support HTML and attachments:

```ts
interface EmailPayload {
  to: string[];
  subject: string;
  text: string;                    // plain-text fallback (kept for spam score)
  html?: string;                   // rendered React Email HTML
  attachments?: Array<{
    filename: string;
    content: string;               // base64-encoded content
    content_type?: string;         // e.g. "text/calendar"
  }>;
}
```

The Resend API body gains `html` and `attachments` fields — same endpoint, additive change.

### Action Changes

Each email action:
1. Resolves booking/venue/org/customer/therapist data (same as today)
2. Also resolves: service name (via `services.getInternal`), venue address/coordinates/placeId
3. Imports template + `render` from `@openschedule/emails`
4. Renders HTML: `render(BookingCreated({ ...props }))`
5. Generates `.ics` string (for created/rescheduled): `generateIcs({ ... })`
6. Builds Google Calendar URL: `buildGoogleCalendarUrl({ ... })`
7. Calls `sendEmail({ to, subject, text, html, attachments })`

The plain `text` field is kept as a readable fallback for email clients that don't render HTML. Each template exports a companion `toPlainText(props)` function that returns a manually formatted string (same content as today's emails — greeting, details, URLs on their own lines). No auto-stripping; the plain text is authored intentionally.

### BetterAuth Invitation Consolidation

The duplicate inline email sender in `betterAuth/auth.ts` (lines 249-269) is replaced with a `ctx.scheduler.runAfter(0, internal.actions.sendInvitationEmail.send, { ... })` call, using the shared action. This fixes the DRY violation and means the invitation also gets the HTML template.

Since the betterAuth `sendInvitationEmail` callback runs inside a mutation context (it has `ctx` with scheduler access), this is straightforward.

### Environment Variables

New on Convex deployment: `GOOGLE_MAPS_API_KEY` (for static map image URLs in emails). Same key as the frontend `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` but without the `NEXT_PUBLIC_` prefix convention since it's server-side.

Existing (unchanged): `RESEND_API_KEY`, `TRANSACTIONAL_FROM_EMAIL`, `WEB_URL`, `APP_URL`.

### Formatting Helpers

Dates and times in email props should be human-readable:
- Date: "Monday, June 23, 2025" (use `date-fns` `format(parseISO(date), "EEEE, MMMM d, yyyy")`)
- Time: "9:00 AM – 10:30 AM" (format both start/end with `h:mm a`, join with " – ")

These formatting functions live in the email actions (not the templates), since the templates receive pre-formatted strings.

## What Each Email Type Includes

| Template | Recipients | Badge | Map | .ics | Calendar URL | CTAs |
|----------|-----------|-------|-----|------|-------------|------|
| Booking Created | Customer | Confirmed (green) | Yes | Yes | Yes | View + Calendar + Cancel |
| Cancelled | Customer + Therapist | Cancelled (red) | No | No | No | Book Again |
| Rescheduled | Customer + Therapist | Rescheduled (blue) | Yes | Yes | Yes | View + Calendar + Cancel |
| Invitation | Invited email | None | No | No | No | Accept |

## Testing

- React Email has a built-in dev server (`email dev`) for visual preview — useful during development but not required for CI
- Unit test: render each template with sample data, assert the output is a non-empty HTML string containing expected text fragments
- Integration: existing E2E flow (booking → email sent via Resend) validates the full pipeline; dev mode logs show the HTML

## Out of Scope

- Org logo in header (would need a publicly accessible URL for the uploaded logo — deferred)
- Unsubscribe link (no marketing emails, all transactional)
- Email analytics / open tracking
- Custom email branding per org (single neutral theme for now)
