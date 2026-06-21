# In-App Notification System Design

## Goal

Provide real-time in-app notifications to admin users (owners and therapists) when bookings are created, cancelled, or rescheduled, and when new therapists join the org.

## Scope

- **In-app only** — requires the admin tab to be open. No browser push, no mobile push (deferred to Expo phase).
- Four event types: `booking_created`, `booking_cancelled`, `booking_rescheduled`, `therapist_joined`.
- Bell icon with unread count badge + dropdown list + toast on arrival.

## Architecture

Convex's real-time subscriptions handle delivery: inserting a doc into a `notifications` table automatically pushes it to any client subscribed to the relevant query. No pub/sub, no WebSocket plumbing needed.

Notification docs are created synchronously inside the existing mutations (same transaction), guaranteeing consistency — if the booking exists, the notification exists.

`sonner` (already installed) provides toast UI.

---

## Schema

```ts
notifications: defineTable({
  recipientId: v.id("users"),
  type: v.union(
    v.literal("booking_created"),
    v.literal("booking_cancelled"),
    v.literal("booking_rescheduled"),
    v.literal("therapist_joined"),
  ),
  orgId: v.id("organizations"),
  payload: v.any(),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_recipientId_and_createdAt", ["recipientId", "createdAt"])
  .index("by_recipientId_and_read", ["recipientId", "read"])
```

No TTL or cleanup for MVP. Future cron can archive old notifications if the table grows.

---

## Payload Shapes

| Type | Payload |
|------|---------|
| `booking_created` | `{ bookingId, customerName, date, startTime, serviceName }` |
| `booking_cancelled` | `{ bookingId, customerName, date, startTime }` |
| `booking_rescheduled` | `{ bookingId, customerName, newDate, newStartTime, rescheduledBy }` |
| `therapist_joined` | `{ therapistName, therapistId }` |

---

## Notification Targeting

| Event | Recipients |
|-------|-----------|
| New booking | Assigned therapist + all owners in the org |
| Cancelled by customer (via token) | Assigned therapist + all owners |
| Rescheduled | Assigned therapist (only if actor is a different user) |
| Therapist joined | All owners in the org |

**"Don't notify yourself" rule:** if the acting user is the same as the recipient, skip that notification. For `cancelWithToken` (customer-initiated, no authenticated user), all targeted users are notified.

**Resolving owners:** query users table with `by_orgId` index, filter `roles.includes("owner")`. Expected set size: 1-3.

---

## Backend

### Helper (`packages/convex/src/lib/notifications.ts`)

```ts
createNotification(ctx: MutationCtx, {
  recipientId: Id<"users">,
  type: NotificationType,
  orgId: Id<"organizations">,
  payload: object,
}): Promise<void>

createNotificationsForOwners(ctx: MutationCtx, {
  orgId: Id<"organizations">,
  type: NotificationType,
  payload: object,
  excludeUserId?: Id<"users">,  // "don't notify yourself"
}): Promise<void>
```

### Hook Points

| Mutation | After | Logic |
|----------|-------|-------|
| `bookings.create` | Insert + email/calendar schedule | Notify assigned therapist + all owners (exclude creator if they're an owner/therapist doing admin booking) |
| `performCancel` via `cancelWithToken` | Status flip | Notify assigned therapist + all owners |
| `performCancel` via `cancel` (auth) | Status flip | Notify assigned therapist + all owners, exclude the actor |
| `bookings.reschedule` | Patch + notification email | Notify assigned therapist if actor !== therapist |
| `betterAuth/auth.ts` `member.onCreate` | User patched with orgId/roles | Notify all owners (the new therapist isn't an owner, so no exclusion needed) |

### Queries (`packages/convex/src/queries/notifications.ts`)

- `listRecent({ limit?: number })` — auth-guarded, returns current user's notifications ordered by `createdAt` desc, default limit 20.
- `unreadCount()` — auth-guarded, returns count where `recipientId = currentUser._id` and `read === false`.

### Mutations (`packages/convex/src/mutations/notifications.ts`)

- `markRead({ id })` — auth-guarded, sets `read: true` on the notification (must belong to current user).
- `markAllRead()` — auth-guarded, patches all unread notifications for current user.

---

## Frontend (Admin App)

### Components

| Component | Responsibility |
|-----------|----------------|
| `components/notification-bell.tsx` | Bell icon + unread badge + Popover trigger. Renders in TopBar and MobileTopBar. |
| `components/notification-list.tsx` | Scrollable list inside popover: icon + text + relative time + read state. "Mark all read" header action. Empty state. |
| `components/notification-toast.tsx` | `useEffect` watching `listRecent` — detects genuinely new notifications (by comparing latest `createdAt` to a ref) and fires a `sonner` toast. Rendered once in the protected layout. |
| `lib/format-notification.ts` | Pure function: `(type, payload) => { icon, text }`. Maps notification types to human-readable strings + lucide icons. |

### Notification Text Templates

- `booking_created`: "New booking — {customerName}, {date} at {startTime}"
- `booking_cancelled`: "Booking cancelled — {customerName}, {date} at {startTime}"
- `booking_rescheduled`: "Booking rescheduled — {customerName}, now {newDate} at {newStartTime}"
- `therapist_joined`: "{therapistName} joined the team"

### Toast Behavior

- Only fires for notifications created AFTER the component mounts (initial load doesn't fire toasts).
- Toast includes the notification text + a "View" action (navigates to relevant page — today view for bookings, team page for new members).
- Auto-dismisses after 5 seconds (sonner default).

### Bell Badge

- Red dot with count when unreadCount > 0, hidden when 0.
- Count capped at "9+" display.

### Popover List

- Each item: type icon (left) + text + relative time (right). Unread items have a subtle blue-dot indicator or slightly bolder background.
- Clicking an item marks it read and navigates (booking → venue today page, therapist → team page).
- "Mark all read" at the top-right of the header.
- Max 20 items shown; no pagination for MVP.

---

## convex-api.ts Types

Add to the admin's typed API map:
- `queries.notifications.listRecent`
- `queries.notifications.unreadCount`
- `mutations.notifications.markRead`
- `mutations.notifications.markAllRead`

---

## Out of Scope

- Browser push notifications (Service Worker)
- Mobile push (Expo/FCM)
- Notification preferences (per-user mute)
- Email digests
- Pagination / infinite scroll in the bell dropdown
- Notification cleanup/TTL
