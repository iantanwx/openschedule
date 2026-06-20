# Google Calendar Integration — Design Spec

## Overview

Therapist-side Google Calendar sync. Any user who takes bookings (owner with therapist role, or invited therapist) can connect their Google Calendar. When a booking is confirmed, a calendar event is created on the therapist's primary calendar. When cancelled or rescheduled, the event is deleted (and recreated for reschedules).

## Scope

- Per-user integration (not org-scoped) — one connection works across all orgs the user belongs to
- Primary calendar only (no calendar picker)
- Fire-and-forget: calendar sync never blocks or fails a booking operation
- No customer-side calendar features in this spec (`.ics` / "Add to Calendar" link is a separate piece)

## OAuth Flow

### Connect

1. User navigates to `/account` (global account settings page, outside org scope)
2. Clicks "Connect Google Calendar"
3. Admin app redirects to `GET /api/integrations/google/authorize`
4. API route builds Google OAuth URL:
   - `response_type=code`
   - `scope=https://www.googleapis.com/auth/calendar.events`
   - `access_type=offline`
   - `prompt=consent` (ensures refresh token is always issued)
   - `state` param contains an opaque token tying the request to the authenticated session (CSRF protection)
   - `redirect_uri` = `{APP_URL}/api/integrations/google/callback`
5. User consents on Google's screen
6. Google redirects to `/api/integrations/google/callback?code=...&state=...`
7. Callback route:
   - Validates `state` against the session
   - Exchanges `code` for `{ access_token, refresh_token, expires_in }` via Google's token endpoint
   - Calls a Convex mutation to upsert the `integrations` doc for this user
   - Redirects browser to `/account?connected=google-calendar`

### Disconnect

1. User clicks "Disconnect" on `/account`
2. Calls a Convex mutation that sets `enabled: false` on the integration doc
3. Does NOT revoke the Google token (user can do that from their Google account)
4. Does NOT delete existing calendar events already created

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GOOGLE_CLIENT_ID` | Admin app + Convex actions | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Admin app + Convex actions | OAuth client secret |
| `APP_URL` | Admin app | Redirect URI base (existing, default `http://localhost:3001`) |

## Token Storage

Uses the existing `integrations` table (already in schema):

```
integrations: defineTable({
  scope: v.literal("user"),
  scopeId: v.id("users"),
  provider: v.literal("google-calendar"),
  version: v.number(),
  config: v.any(),       // { accessToken, refreshToken, expiresAt }
  enabled: v.boolean(),
})
  .index("by_scopeId", ["scopeId"])
  .index("by_scopeId_and_provider", ["scopeId", "provider"])
```

- `config.accessToken`: short-lived Google access token
- `config.refreshToken`: long-lived refresh token (persists across sessions)
- `config.expiresAt`: Unix timestamp (ms) when `accessToken` expires
- `version`: `1` for initial schema
- `enabled`: `true` when connected, `false` when disconnected

### Token Refresh

Inline refresh before each API call:
1. Read integration doc
2. If `Date.now() >= config.expiresAt - 60_000` (expired or within 60s of expiry):
   - POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`
   - Update `config.accessToken` and `config.expiresAt` on the doc
3. Proceed with fresh `accessToken`

If refresh fails (token revoked by user), log the error, set `enabled: false`, and return silently. The user will see "Disconnected" on their account page next time they visit.

## Schema Change

Add to `bookings` table:

```
googleCalendarEventId: v.optional(v.string())
```

Stores the Google Calendar event ID so we can delete it on cancel/reschedule.

## Event Lifecycle

| Booking mutation | Calendar action | Details |
|-----------------|----------------|---------|
| `confirm` | Create event | Store returned `eventId` as `googleCalendarEventId` on booking |
| `cancel` (auth or token) | Delete event | Clear `googleCalendarEventId` |
| `reschedule` | Delete old + create new | Update `googleCalendarEventId` with new event's ID |

### Calendar Event Content

- **Summary (title):** `Booking: {customerName} — {serviceName}`
  - If no service: `Booking: {customerName}`
- **Start/End:** Booking `startTime`/`endTime` on booking `date`, in the venue's timezone
- **Description:** `Customer: {customerName}\nEmail: {customerEmail}\nPhone: {customerPhone || "Not provided"}`
- **Calendar:** `primary` (therapist's default calendar)

### When to Skip

The action returns silently (no error) when:
- Therapist has no integration doc
- Integration exists but `enabled: false`
- Token refresh fails (also sets `enabled: false`)
- Google API returns an error (log it, don't retry)
- Delete called but `googleCalendarEventId` is null (event was never created or already deleted)

## Convex Action

New internal action: `actions/syncCalendarEvent.ts`

```
args: {
  bookingId: v.id("bookings"),
  action: v.union(v.literal("create"), v.literal("delete"))
}
```

Called via `ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, { bookingId, action })` from:
- `mutations/bookings.ts → confirm`: `action: "create"`
- `mutations/bookings.ts → cancel` (auth-guarded): `action: "delete"`
- `mutations/bookings.ts → cancelWithToken`: `action: "delete"`
- `mutations/bookings.ts → reschedule`: `action: "delete"` (old), then `action: "create"` (new — scheduled after patch)

Resolution order inside the action:
1. Load booking (bail if missing)
2. Load therapist's integration via `by_scopeId_and_provider` index (bail if missing/disabled)
3. Refresh token if needed (bail + disable if refresh fails)
4. For `"create"`: POST to Google Calendar API → store eventId on booking via `ctx.runMutation`
5. For `"delete"`: read `googleCalendarEventId` from booking (bail if null) → DELETE to Google Calendar API → clear field via `ctx.runMutation`

## Integrations Queries & Mutations

### Queries

- `queries/integrations.ts → getByUser({ userId })` — returns `{ provider, enabled, connectedAt }` (never exposes tokens to client)

### Mutations

- `mutations/integrations.ts → upsert({ userId, provider, config })` — creates or updates the integration doc (called from the callback route)
- `mutations/integrations.ts → disconnect({ userId, provider })` — sets `enabled: false`
- `mutations/integrations.ts → updateConfig({ id, config })` — internal mutation for token refresh (called from inside the action)

## Admin App Changes

### New Route: `/account`

Global user settings page (outside org scope, under `(protected)/`). Contains:

1. **Profile section** — name, email, avatar (read-only for now; editable in future)
2. **Integrations section** — card per integration type:
   - Google Calendar: connected/disconnected status, "Connect" / "Disconnect" button
   - When connected: shows the Google email used + connected date

### TopBar Change

Avatar area gets a dropdown menu (or link) to `/account`. This replaces or supplements the existing inline account card in org settings.

### API Routes

- `apps/admin/app/api/integrations/google/authorize/route.ts` — GET handler, builds OAuth URL, redirects
- `apps/admin/app/api/integrations/google/callback/route.ts` — GET handler, exchanges code, stores tokens, redirects to `/account`

State parameter for CSRF: generate a random string, store in an HTTP-only cookie, verify on callback.

## Dependencies

- `googleapis` package in `packages/convex` (for Calendar API calls in the action) — or raw `fetch` to avoid the heavy dependency. **Decision: use raw `fetch`** to keep the Convex bundle lean. The Calendar API is simple REST.
- No new dependencies in the admin app (Next.js API routes + fetch are sufficient for the OAuth exchange).

## Testing

- Unit tests for token refresh logic (mock fetch)
- Unit test for `syncCalendarEvent` action structure (mock external calls)
- E2E: connect flow via agent-browser (requires real or mocked Google OAuth — may need to test with a real Google Cloud project in dev)

## Out of Scope

- Customer-side `.ics` / "Add to Google Calendar" link (separate spec)
- Calendar picker (always primary)
- Retry on failure
- Syncing existing bookings retroactively on connect
- Two-way sync (reading from Google Calendar to block slots)
- Org-scoped integrations
