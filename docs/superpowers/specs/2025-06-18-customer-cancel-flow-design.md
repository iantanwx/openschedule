# Customer Cancel Flow — Design

**Date:** 2025-06-18
**Status:** Approved (brainstormed 2025-06-18)
**Scope:** Customer-facing cancellation of a booking in `apps/web`.

## Goal

Let a customer cancel their own booking through a self-service link, completing the
`/bookings/:bookingId/cancel` route promised by the platform design spec
(`docs/superpowers/specs/2025-06-14-openschedule-design.md`) but not yet built.

## Context

- `apps/web` has **no customer auth**. Bookings are created as `status: "pending"`; the
  bookingId (an unguessable Convex ID) is the implicit capability token for viewing at
  `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/page.tsx`.
- The design's "pending → confirmed on link click" mechanism is **not** built; bookings
  stay `pending` until an owner/therapist confirms them via the admin app.
- **Pre-existing security gap:** `bookings.cancel` (`packages/convex/src/mutations/bookings.ts:129`)
  performs **no auth check** — unlike `confirm` and `reschedule`, which call
  `getAuthenticatedUser` / `assertRole`. Anyone with a bookingId can cancel today.
- No "booking created" email exists. The existing `sendBookingNotification` action only
  fires on `confirmed` / `cancelled` / `rescheduled`.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Authorization model | **Separate per-booking `cancelToken`** (random), distinct from the bookingId capability used for viewing. |
| Token delivery | **Email only** — via a new "booking created" email (which also fills a spec gap). The public view page does **not** show cancel; it directs the customer to their email. Showing the token-bearing link on a bookingId-gated page would defeat the separate token. |
| Cancellation cutoff | **None.** Customer may cancel any time before the appointment start. |
| Reason capture | **None.** Cancel is a pure status flip; no schema field for reason. |
| Confirm step | **Yes** — the cancel page shows a summary and a "Cancel booking" confirm button; no cancel happens on page load. |
| Token lifecycle | The token stays valid for the life of the booking. After cancellation the page renders an "already cancelled" state rather than erroring. |
| Confirm-by-link (`pending`→`confirmed`) | **Out of scope** here (separate feature). |

## Data model

**`packages/convex/src/schema.ts` — bookings table:** add one field.

```ts
cancelToken: v.optional(v.string()),
```

- Optional so existing dev bookings do not fail schema validation on deploy.
- The `create` mutation **always** sets it on new bookings, so every customer-created
  booking is customer-cancellable. Pre-existing bookings simply are not
  customer-cancellable (acceptable pre-launch).
- No index required: lookups go by `_id`, then the token is compared against the fetched
  document.
- The public `queries/bookings.ts → get` DTO and the `internal/bookings.ts → getInternal`
  resolver must **not** expose `cancelToken` to clients.

## Backend (`packages/convex/src/`)

### `mutations/bookings.ts → create` (modified)

- Generate `const cancelToken = crypto.randomUUID();` (`crypto.randomUUID` is available in
  the Convex mutation runtime) and include it in the `ctx.db.insert("bookings", { … })`
  call alongside the existing fields.
- After insert, schedule the new created-email, mirroring the `confirm`/`cancel` pattern:
  ```ts
  await ctx.scheduler.runAfter(0, internal.actions.sendBookingCreatedEmail.send, {
    bookingId,
  });
  ```
- Return the new booking id unchanged.

### `mutations/bookings.ts → cancel` (existing, locked down)

Close the auth gap by prefixing with the same guard pair used by `confirm`/`reschedule`:

```ts
const user = await getAuthenticatedUser(ctx);
assertRole(user, ["owner", "therapist"]);
const booking = await ctx.db.get(args.id);
if (!booking) throw new Error("Booking not found");
const venue = await ctx.db.get(booking.venueId);
if (venue) assertOrgAccess(user, venue.orgId);
await performCancel(ctx, args.id);
```

Admin `convex-api.ts` needs no change — the public signature stays `{ id }`.

### `mutations/bookings.ts → cancelWithToken` (new, public, no auth)

```ts
export const cancelWithToken = mutation({
  args: { id: v.id("bookings"), cancelToken: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    if (!booking.cancelToken || booking.cancelToken !== args.cancelToken) {
      throw new Error("Invalid or missing cancel token");
    }
    await performCancel(ctx, args.id);
  },
});
```

### `lib/bookings.ts → performCancel` (new shared helper)

Single source of truth for the status-flip + notification, used by both `cancel` (after
auth) and `cancelWithToken` (after token check):

```ts
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export async function performCancel(ctx: MutationCtx, bookingId: Id<"bookings">) {
  const booking = await ctx.db.get(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") {
    throw new Error("Booking is already cancelled");
  }
  await ctx.db.patch(bookingId, { status: "cancelled" });
  await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
    bookingId,
    event: "cancelled",
  });
}
```

> **Note:** `cancelWithToken` reads the booking twice (once for the token check, once in
> the helper). This is negligible cost and keeps the helper self-contained and
> independently testable. If a single read is preferred later, `performCancel` can accept
> an already-fetched doc — defer this as a cleanup, not part of this feature.

### `actions/sendBookingCreatedEmail.ts` (new internal action)

Follows the shape of `sendBookingNotification.ts`:

- Resolve, via `internal.queries.internal.*`: booking → customer → therapist → venue
  (for `venueSlug` and `orgId`).
- Resolve the **organization** to obtain `orgSlug`. There is no
  `queries/internal/organizations.ts` resolver today; the plan will add a minimal
  `getInternal({ id })` for organizations (or extend the venue internal resolver to return
  `orgSlug` via a join). Pick one during planning.
- Honor the same org gate as the notification action: skip if
  `settings.emailNotificationsEnabled` is false. (Implication: an org that disables email
  notifications also loses self-service cancel links; acceptable for MVP and consistent
  with the existing email gate.)
- Build absolute URLs using a **new env var** `WEB_URL` (default
  `http://localhost:3000`) — **not** `APP_URL` (default `:3001`, the admin origin used by
  `sendInvitationEmail`):
  - view:  `${WEB_URL}/${orgSlug}/${venueSlug}/bookings/${bookingId}`
  - cancel: `${WEB_URL}/${orgSlug}/${venueSlug}/bookings/${bookingId}/cancel?token=${cancelToken}`
- Plain-text body (consistent with current emails): booking summary (date, start–end,
  therapist name), a line "We've received your booking request — the studio will confirm
  shortly.", the view link, and the cancel link labelled clearly as "Cancel this booking".
- Recipients: `[customer.email]` (customer only — the therapist has no need for the
  request-received email; the existing notification still fires on `confirmed`/`cancelled`).
- Send via the existing `sendEmail` Resend wrapper, which already logs + swallows failures.

## Frontend (`apps/web`)

### New route: `bookings/[bookingId]/cancel`

- `app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/page.tsx` — server component,
  reads `bookingId` from params, renders `<CancelPage bookingId={bookingId} />`.
- `app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/cancel-page.tsx` — client
  component:
  - Reads `token` from `useSearchParams()`. If absent → render an error state
    ("This cancel link is invalid.").
  - Loads the booking summary via `queries.bookings.get({ id: bookingId })` (existing public
    query; returns the `Booking` DTO with date/start/end/status — enough for a summary; no
    `cancelToken` is exposed).
  - **States:**
    - **Loading** — skeleton.
    - **Booking not found** — "We couldn't find this booking."
    - **Already cancelled** (`status === "cancelled"`) — "This booking has already been
      cancelled." (No button.)
    - **Active** (`pending` or `confirmed`) — show summary + a "Cancel booking" button.
      Clicking calls `mutations.bookings.cancelWithToken({ id, cancelToken: token })`.
    - **On success** — success state: "Your booking has been cancelled." + a link back to
      the venue.
    - **On error** — surface the mutation error message; if it indicates an invalid token,
      show the invalid-token state.

### View page change

`bookings/[bookingId]/confirmation-page.tsx` (and `components/booking-confirmation.tsx`):
remove any cancel affordance and add a static note: "To cancel this booking, use the link
in your confirmation email." (Cancel is never offered on the bookingId-gated page, per the
authorization decision.)

### Type map

Extend the web app's inline `convexApi` cast (`api as unknown as { … }`) in the cancel
page (and only where needed) to include `mutations.bookings.cancelWithToken`. The existing
`queries.bookings.get` is already adequate; no new query is required.

## Error handling

| Case | Behavior |
| --- | --- |
| Missing `?token=` on the cancel page | Render "invalid cancel link" state; do not call the mutation. |
| Wrong / missing token (incl. old bookings with `cancelToken === undefined`) | Mutation throws `Invalid or missing cancel token`; UI shows invalid-token state. |
| Booking not found | Query returns `null` → "couldn't find this booking"; mutation throws `Booking not found`. |
| Already cancelled | UI shows already-cancelled state from `status`; calling the mutation again throws `Booking is already cancelled` (idempotent display). |
| "booking created" email fails to send | Swallowed by `sendEmail`; booking is still created and still cancellable. |

## Testing

Convex tests (`packages/convex/src/tests/`, using `vitest` + `convex-test` +
`@edge-runtime/vm`):

- `create` generates and stores a `cancelToken` and schedules `sendBookingCreatedEmail`.
- `cancelWithToken`:
  - with a valid token flips status to `cancelled` and schedules the `cancelled`
    notification;
  - with a wrong token throws `Invalid or missing cancel token` and does **not** change
    status;
  - on an already-cancelled booking throws `Booking is already cancelled`;
  - on a missing booking throws `Booking not found`.
- `cancel` (admin) without an authenticated owner/therapist session throws (auth gap
  closed); with a valid owner session it cancels.

Frontend behavior for the cancel page states is verified via the `next-dev-loop` /
`agent-browser` skills against a running app during implementation (manual, not unit
tests).

## Out of scope

- Confirm-by-link (`pending` → `confirmed` via email link).
- `.ics` attachment / "Add to Google Calendar" link in emails.
- Cancellation reason capture.
- Time-based cancellation cutoffs / windows.
- Google Calendar integration / OAuth.
- Customer accounts / authentication.
