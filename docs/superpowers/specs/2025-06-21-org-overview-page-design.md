# Org Overview Page Design

## Summary

Replace the time-grid org dashboard with a stats summary + activity feed when "All Venues" is selected.

## Stats Cards

Top row of 4 metric cards for today (across all org venues):

| Card | Source | Display |
|------|--------|---------|
| Bookings Today | count of non-cancelled bookings across all venues for today | number |
| Confirmed | count where status = "confirmed" | number, green accent |
| Pending | count where status = "pending" | number, amber accent |
| Revenue Today | sum of service.price (cents → dollars) for confirmed bookings | formatted currency |

Revenue resolves service price via serviceId on each booking. Bookings without a serviceId contribute $0.

Therapist view: same cards but filtered to their own bookings only.

## Activity Feed

Chronological list of recent events below the stats cards.

- Source: new query `notifications.listOrgActivity({ orgId, limit })` reading from the existing `notifications` table.
- Owner: sees all notifications for the org.
- Therapist: sees only notifications where `recipientId === self`.
- Display: icon + descriptive text + relative timestamp. Most recent first.
- Limit: 50 items.
- No pagination (scroll to see all 50).

## Notification Bell Scope Change

Current behavior: owners get notifications for every therapist's booking events.

New behavior:
- **Therapists:** own booking events (booking_created, cancelled, rescheduled) — unchanged.
- **Owners:** only `therapist_joined` events in the bell. Booking activity is visible in the activity feed instead.

Implementation: remove `createNotificationsForOwners` calls from `bookings.create`, `cancel`, `cancelWithToken`, and `reschedule`. Keep it in `member.onCreate` (therapist_joined).

## Backend

- New query: `notifications.listOrgActivity` — auth-guarded, accepts `{ orgId, limit }`. Owner returns all notifications for that orgId ordered by createdAt desc. Therapist returns only their own (recipientId = user._id, same orgId).
- New query: `bookings.statsByOrg` — accepts `{ orgId, date }`. Returns `{ total, confirmed, pending, revenue }`. Revenue = sum of resolved service prices. Therapist-scoped variant filters by therapistId.

## Frontend

- Rewrite `org-dashboard-page.tsx` to render stats cards + activity feed (no time grid).
- Stats cards use a simple grid of Card components with number + label.
- Activity feed reuses the formatting logic from `lib/format-notification.ts`.

## Out of Scope

- Venue health cards (deferred)
- Pagination on activity feed
- Date range selection for stats (always today)
