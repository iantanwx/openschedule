# Customer Cancel Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer self-cancel a booking via a token-bearing link, delivered in a new "booking created" email — closing the platform's missing `/bookings/:bookingId/cancel` route and a pre-existing unauthenticated-cancel security gap.

**Architecture:** A separate per-booking `cancelToken` (distinct from the bookingId-as-capability used for viewing) authorizes cancellation. A new public mutation `bookings.cancelWithToken({ id, cancelToken })` flips status after a constant-time-ish token compare; a shared `performCancel` helper also backs the now-auth-guarded admin `bookings.cancel`. A new internal action `sendBookingCreatedEmail` (scheduled from `create`) emails the customer the view + cancel links. The customer-facing cancel route renders a confirm step with explicit states (missing token, not found, already cancelled, active, success).

**Tech Stack:** Convex (mutations, internal actions, internal queries, `ctx.scheduler.runAfter`), vitest + convex-test + @edge-runtime/vm, Next.js 16 App Router (server + client components), `useSearchParams`, shadcn/ui (`@openschedule/ui`).

**Source of truth spec:** `docs/superpowers/specs/2025-06-18-customer-cancel-flow-design.md`. Read it before starting.

---

## File Structure

**Backend — `packages/convex/src/`:**
- `schema.ts` (modify) — add `cancelToken: v.optional(v.string())` to the `bookings` table.
- `lib/bookings.ts` (create) — `performCancel(ctx, bookingId)` shared status-flip + notification scheduler.
- `mutations/bookings.ts` (modify) — `create` sets token + schedules created-email; `cancel` gains auth guards and calls `performCancel`; add `cancelWithToken`.
- `queries/internal/organizations.ts` (create) — `getInternal({ id })` (mirrors existing per-table internal resolvers; needed for `orgSlug` in the email URLs).
- `actions/sendBookingCreatedEmail.ts` (create) — internal action; resolves booking/venue/org/customer/therapist, honors the org email-notification gate, sends view + cancel links using a new `WEB_URL` env var.
- `tests/bookings.test.ts` (modify) — update the two tests that call unauthenticated `cancel`, add auth + token tests.

**Frontend — `apps/web/`:**
- `components/booking-confirmation.tsx` (modify) — remove the cancel button/handler/mutation (the bookingId-gated page must not offer cancel); add a static "use the link in your email" note.
- `app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/page.tsx` (create) — server component, reads params.
- `app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/cancel-page.tsx` (create) — client component with all UI states.

**Regenerated (not hand-edited):** `packages/convex/src/_generated/*` via `convex codegen`.

---

## Conventions for every task

- **Package manager:** `pnpm`. Use `pnpm dlx` for one-off binaries. Never `npx`.
- **No `!` non-null assertions** (repo hygiene rule). Narrow with guards / early returns.
- **No `/// <reference />` directives** in tests. Type support for `import.meta.glob` comes from `"types": ["vite/client"]` in tsconfig.
- **Never start dev servers** (`pnpm dev`, `convex dev`, `next dev`). The user manages those. For Convex, run the one-shot `convex codegen` instead.
- **Commits:** semantic (`feat:`, `fix:`, `test:`, `refactor:`). Commit at the end of each task.
- **Convex typing:** use `Doc<>` / `Id<>` from `_generated/dataModel`; contexts from `_generated/server`.

### Codegen reminder

Any task that adds/changes a Convex schema field, mutation, query, action, or internal function changes the generated `api`/`dataModel` types. After such a change, regenerate before typechecking:

```
pnpm dlx convex codegen
```

Run from `packages/convex` (it reads `.env.local` for the deployment). This is a one-shot generator — it does **not** start a dev server and does **not** modify the deployment. Your code will not typecheck without it.

---

## Task 1: Add `cancelToken` to the bookings schema

**Files:**
- Modify: `packages/convex/src/schema.ts` (bookings `defineTable`, currently lines 60–83)

- [ ] **Step 1: Add the field**

In `packages/convex/src/schema.ts`, inside the `bookings: defineTable({ … })` block, add `cancelToken` after `overCapacity: v.boolean(),`:

```ts
    overCapacity: v.boolean(),
    cancelToken: v.optional(v.string()),
  })
```

- [ ] **Step 2: Regenerate Convex types**

Run (workdir `packages/convex`):

```
pnpm dlx convex codegen
```

Expected: completes without error; `_generated/dataModel.d.ts` now includes `cancelToken?: string` on the bookings document.

- [ ] **Step 3: Typecheck**

```
pnpm --filter @openschedule/convex typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add packages/convex/src/schema.ts packages/convex/src/_generated
git commit -m "feat(convex): add cancelToken to bookings schema"
```

---

## Task 2: Shared `performCancel` helper + lock down `cancel` (close security gap)

`bookings.cancel` currently performs **no auth check** (unlike `confirm`/`reschedule`). We add the same guard pair and extract the status-flip + notification into a shared helper so both `cancel` (post-auth) and the upcoming `cancelWithToken` (post-token) share one code path.

**Files:**
- Create: `packages/convex/src/lib/bookings.ts`
- Modify: `packages/convex/src/mutations/bookings.ts` (`cancel`, currently lines 129–145)
- Test: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/convex/src/tests/bookings.test.ts`:

(a) **Add** a new test inside the top-level `describe("booking mutations", () => { … })` block (e.g. right after the existing `"confirms a pending booking (requires auth)"` test). This captures the security-gap fix:

```ts
  test("cancel requires an authenticated owner or therapist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Unauthenticated cancel must be rejected (security gap closed)
    await expect(
      t.mutation(api.mutations.bookings.cancel, { id: bookingId }),
    ).rejects.toThrow();

    // Status unchanged
    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("pending");
  });
```

(b) **Modify** the existing `"cancels a booking"` test (the one whose comment says "Cancel is still public (customers can cancel)"). Replace the comment + the unauthenticated cancel call with an authenticated owner cancel. Find this block:

```ts
    // Cancel is still public (customers can cancel)
    await t.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
```

Replace with:

```ts
    // Cancel now requires an authenticated owner/therapist
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
        orgId,
      });
    });
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
```

(c) **Modify** the existing `"prevents rescheduling a cancelled booking"` test. Its unauthenticated cancel call currently reads:

```ts
    await t.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const asTherapist = t.withIdentity({
```

Replace that cancel call with an authenticated owner cancel. First, add an owner user right before the cancel (insert it after the existing `customerId` / `bookingId` setup in that test), then cancel as that owner. Concretely, replace:

```ts
    await t.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });
```

with:

```ts
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
        orgId,
      });
    });
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

```
pnpm --filter @openschedule/convex exec vitest run src/tests/bookings.test.ts
```

Expected: FAIL. The new test fails because `cancel` is still public (no throw). The two modified tests fail because the (still-public) `cancel` happens to still work — wait, see note.

> Note: Until `cancel` is locked down in Step 3, the new auth test fails (cancel does not throw) while the two modified tests will actually still *pass* (the public cancel succeeds). That is expected mid-task. The authoritative failure to watch is the new auth test. After Step 3 all three behave correctly.

- [ ] **Step 3: Create the shared helper**

Create `packages/convex/src/lib/bookings.ts`:

```ts
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Flip a booking to "cancelled" and schedule the cancelled notification.
 * Single source of truth shared by the auth-guarded admin `cancel` and the
 * token-gated public `cancelWithToken`. Throws if the booking is missing or
 * already cancelled.
 */
export async function performCancel(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
): Promise<void> {
  const booking = await ctx.db.get(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }
  if (booking.status === "cancelled") {
    throw new Error("Booking is already cancelled");
  }
  await ctx.db.patch(bookingId, { status: "cancelled" });
  await ctx.scheduler.runAfter(
    0,
    internal.actions.sendBookingNotification.send,
    { bookingId, event: "cancelled" },
  );
}
```

- [ ] **Step 4: Lock down `cancel` and use the helper**

In `packages/convex/src/mutations/bookings.ts`, replace the entire `cancel` export (currently lines 129–145):

```ts
export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled");
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "cancelled",
    });
  },
});
```

with:

```ts
export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const venue = await ctx.db.get(booking.venueId);
    if (venue) {
      assertOrgAccess(user, venue.orgId);
    }

    await performCancel(ctx, args.id);
  },
});
```

Add the helper import at the top of the file (with the other `lib` imports, near line 4–5):

```ts
import { performCancel } from "../lib/bookings";
```

(`getAuthenticatedUser`, `assertRole`, `assertOrgAccess`, `internal` are already imported.)

- [ ] **Step 5: Regenerate types and typecheck**

```
pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: PASS.

- [ ] **Step 6: Run the tests to verify they pass**

```
pnpm --filter @openschedule/convex exec vitest run src/tests/bookings.test.ts
```

Expected: PASS (new auth test, plus the two modified tests).

- [ ] **Step 7: Commit**

```
git add packages/convex/src/lib/bookings.ts packages/convex/src/mutations/bookings.ts packages/convex/src/tests/bookings.test.ts packages/convex/src/_generated
git commit -m "fix(convex): require auth to cancel a booking; extract performCancel"
```

---

## Task 3: Public `cancelWithToken` mutation

**Files:**
- Modify: `packages/convex/src/mutations/bookings.ts` (add new export after `cancel`)
- Test: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe("booking mutations", () => { … })` block in `packages/convex/src/tests/bookings.test.ts`:

```ts
  test("cancelWithToken cancels a booking with a valid token", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Seed a known token directly so this test is independent of the create-time
    // token wiring (which lands in Task 5). Task 5 adds its own create-token test.
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "test-cancel-token" });
    });

    await t.mutation(api.mutations.bookings.cancelWithToken, {
      id: bookingId,
      cancelToken: "test-cancel-token",
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });

  test("cancelWithToken rejects a wrong token and leaves status unchanged", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "real-token" });
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "definitely-not-the-token",
      }),
    ).rejects.toThrow("Invalid or missing cancel token");

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("pending");
  });

  test("cancelWithToken on an already-cancelled booking throws", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "test-cancel-token" });
    });
    await t.mutation(api.mutations.bookings.cancelWithToken, {
      id: bookingId,
      cancelToken: "test-cancel-token",
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "test-cancel-token",
      }),
    ).rejects.toThrow("Booking is already cancelled");
  });

  test("cancelWithToken throws when the booking does not exist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Remove it, then try to cancel the now-missing id
    await t.run(async (ctx) => {
      await ctx.db.delete(bookingId);
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "any",
      }),
    ).rejects.toThrow("Booking not found");
  });
```

> These tests seed a known `cancelToken` via `ctx.db.patch` so they are independent of the `create`-time token wiring (Task 5). All four pass as soon as `cancelWithToken` (Step 2) is implemented.

- [ ] **Step 2: Implement `cancelWithToken`**

In `packages/convex/src/mutations/bookings.ts`, add this export immediately after the `cancel` mutation:

```ts
export const cancelWithToken = mutation({
  args: { id: v.id("bookings"), cancelToken: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (!booking.cancelToken || booking.cancelToken !== args.cancelToken) {
      throw new Error("Invalid or missing cancel token");
    }
    await performCancel(ctx, args.id);
  },
});
```

- [ ] **Step 3: Regenerate types and typecheck**

```
pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the tests to verify they pass**

```
pnpm --filter @openschedule/convex exec vitest run src/tests/bookings.test.ts
```

Expected: PASS (all four `cancelWithToken` tests).

- [ ] **Step 5: Commit**

```
git add packages/convex/src/mutations/bookings.ts packages/convex/src/tests/bookings.test.ts packages/convex/src/_generated
git commit -m "feat(convex): add public cancelWithToken mutation"
```

---

## Task 4: Internal organization resolver (for `orgSlug` in the created email)

**Files:**
- Create: `packages/convex/src/queries/internal/organizations.ts`

- [ ] **Step 1: Create the resolver**

Create `packages/convex/src/queries/internal/organizations.ts`. It mirrors the existing per-table internal resolvers (`venues.ts`, `bookings.ts`, `customers.ts`):

```ts
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 2: Regenerate types and typecheck**

```
pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: PASS. `internal.queries.internal.organizations.getInternal` now resolves.

- [ ] **Step 3: Commit**

```
git add packages/convex/src/queries/internal/organizations.ts packages/convex/src/_generated
git commit -m "feat(convex): add internal organizations.getInternal resolver"
```

---

## Task 5: "Booking created" email action + wire `create` to set token & schedule it

**Files:**
- Create: `packages/convex/src/actions/sendBookingCreatedEmail.ts`
- Modify: `packages/convex/src/mutations/bookings.ts` (`create` insert + return, currently lines 85–96)
- Test: `packages/convex/src/tests/bookings.test.ts` (assert `create` stores a token)

- [ ] **Step 1: Create the action**

Create `packages/convex/src/actions/sendBookingCreatedEmail.ts`. It follows the shape of `sendBookingNotification.ts`, resolves the org for `orgSlug`, honors the org email-notification gate, and uses a new `WEB_URL` env var (customer app origin; do **not** reuse `APP_URL`, which is the admin origin):

```ts
"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendEmail } from "./email";

export const send = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} not found, skipping created email`,
      );
      return;
    }

    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    // Honor the org's email-notification gate (consistent with sendBookingNotification)
    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );
    if (!settings || !settings.emailNotificationsEnabled) return;

    const organization = await ctx.runQuery(
      internal.queries.internal.organizations.getInternal,
      { id: venue.orgId },
    );
    if (!organization) return;

    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );
    if (!customer || !therapist) return;

    if (!booking.cancelToken) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} has no cancelToken, skipping created email`,
      );
      return;
    }

    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`;

    const subject = `Booking request received — ${booking.date} at ${booking.startTime}`;
    const body = [
      `Hi ${customer.name},`,
      ``,
      `We've received your booking request — the studio will confirm shortly.`,
      ``,
      `Booking details:`,
      `Date: ${booking.date}`,
      `Time: ${booking.startTime} – ${booking.endTime}`,
      `Therapist: ${therapist.name}`,
      ``,
      `View your booking:`,
      viewUrl,
      ``,
      `Need to cancel? Use this link:`,
      cancelUrl,
    ].join("\n");

    await sendEmail({
      to: [customer.email],
      subject,
      text: body,
    });
  },
});
```

- [ ] **Step 2: Wire `create` to set the token and schedule the email**

In `packages/convex/src/mutations/bookings.ts`, replace the insert + return at the end of `create` (currently lines 85–96):

```ts
    return await ctx.db.insert("bookings", {
      venueId: args.venueId,
      therapistId: args.therapistId,
      customerId: args.customerId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      status: "pending",
      createdBy: args.createdBy,
      overCapacity: args.overCapacity ?? false,
    });
  },
});
```

with:

```ts
    const cancelToken = crypto.randomUUID();
    const bookingId = await ctx.db.insert("bookings", {
      venueId: args.venueId,
      therapistId: args.therapistId,
      customerId: args.customerId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      status: "pending",
      createdBy: args.createdBy,
      overCapacity: args.overCapacity ?? false,
      cancelToken,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.actions.sendBookingCreatedEmail.send,
      { bookingId },
    );
    return bookingId;
  },
});
```

`internal` is already imported at the top of the file. `crypto.randomUUID()` is available in the Convex mutation runtime (and in the @edge-runtime/vm test environment).

- [ ] **Step 3: Add a test that `create` stores a cancelToken**

In `packages/convex/src/tests/bookings.test.ts`, add inside the `describe` block:

```ts
  test("create stores a cancelToken on the booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        role: "therapist",
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const token = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId);
      return b?.cancelToken;
    });
    expect(typeof token).toBe("string");
    expect((token as string | undefined)?.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Regenerate types, typecheck, and run ALL tests**

```
pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
pnpm --filter @openschedule/convex test
```

Expected: typecheck PASS; **all** tests PASS — including the Task 3 `cancelWithToken` tests (valid token, wrong token, already-cancelled, not-found) and the new `create` token test.

- [ ] **Step 5: Commit**

```
git add packages/convex/src/actions/sendBookingCreatedEmail.ts packages/convex/src/mutations/bookings.ts packages/convex/src/tests/bookings.test.ts packages/convex/src/_generated
git commit -m "feat(convex): send booking-created email with cancel token on create"
```

---

## Task 6: Remove the cancel affordance from the bookingId-gated view page

Per the authorization decision, the page reached by the bookingId capability must **not** offer cancel (that would defeat the separate `cancelToken`). Remove the existing cancel button/handler and add a static note pointing to the email.

**Files:**
- Modify: `apps/web/components/booking-confirmation.tsx`

- [ ] **Step 1: Update imports**

In `apps/web/components/booking-confirmation.tsx`, replace the import block at the top:

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Button } from "@openschedule/ui/components/button"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"
```

with:

```tsx
"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"
```

(`useState`, `useMutation`, and `Button` were only used by the cancel button we are removing.)

- [ ] **Step 2: Remove the cancel mutation from the type map**

Replace the `convexApi` cast block:

```tsx
// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
  mutations: {
    bookings: { cancel: FunctionReference<"mutation"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic
const bookingsCancel = convexApi.mutations.bookings.cancel
```

with:

```tsx
// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic
```

- [ ] **Step 3: Remove the cancel handler and state**

Replace the component body's first lines:

```tsx
export function BookingConfirmation({ bookingId }: BookingConfirmationProps) {
  const booking = useQuery(bookingsGet, { id: bookingId })
  const cancelBooking = useMutation(bookingsCancel)
  const [isCancelling, setIsCancelling] = useState(false)

  if (booking === undefined) {
```

with:

```tsx
export function BookingConfirmation({ bookingId }: BookingConfirmationProps) {
  const booking = useQuery(bookingsGet, { id: bookingId })

  if (booking === undefined) {
```

Then delete the now-orphaned `handleCancel` function entirely:

```tsx
  async function handleCancel() {
    setIsCancelling(true)
    try {
      await cancelBooking({ id: bookingId })
    } catch {
      setIsCancelling(false)
    }
  }
```

- [ ] **Step 4: Replace the cancel button with an email note**

Replace the cancel-button block at the bottom of the returned JSX:

```tsx
      {booking.status !== "cancelled" && (
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? "Cancelling..." : "Cancel Booking"}
        </Button>
      )}
    </div>
  )
}
```

with:

```tsx
      {booking.status !== "cancelled" && (
        <p className="text-center text-sm text-muted-foreground">
          Need to cancel? Use the link in your booking confirmation email.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```
git add apps/web/components/booking-confirmation.tsx
git commit -m "refactor(web): remove cancel affordance from booking view page"
```

---

## Task 7: New customer cancel route

**Files:**
- Create: `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/page.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/cancel-page.tsx`

- [ ] **Step 1: Create the server component (route entry)**

Create `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/page.tsx`, mirroring the sibling booking `page.tsx` param shape:

```tsx
import { CancelPage } from "./cancel-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; bookingId: string }>
}

export default async function CancelBookingPage({ params }: PageProps) {
  const { orgSlug, venueSlug, bookingId } = await params
  return (
    <CancelPage orgSlug={orgSlug} venueSlug={venueSlug} bookingId={bookingId} />
  )
}
```

- [ ] **Step 2: Create the client component with all states**

Create `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel/cancel-page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Button } from "@openschedule/ui/components/button"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    bookings: { get: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
  mutations: {
    bookings: { cancelWithToken: FunctionReference<"mutation"> }
  }
}

const bookingsGet = convexApi.queries.bookings.get
const usersGetPublic = convexApi.queries.users.getPublic
const bookingsCancelWithToken = convexApi.mutations.bookings.cancelWithToken

interface CancelPageProps {
  orgSlug: string
  venueSlug: string
  bookingId: string
}

export function CancelPage({ orgSlug, venueSlug, bookingId }: CancelPageProps) {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const booking = useQuery(bookingsGet, { id: bookingId })
  const cancelBooking = useMutation(bookingsCancelWithToken)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const venueHref = `/${orgSlug}/${venueSlug}`

  // No token in the URL → the link is invalid; never call the mutation.
  if (!token) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Invalid cancel link</h1>
        <p className="mt-2 text-muted-foreground">
          This cancel link is invalid. Use the link from your booking email.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  if (booking === undefined) {
    return <Skeleton className="mx-auto mt-12 h-96 w-full max-w-md" />
  }

  if (!booking) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t find this booking.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  // Already-cancelled (either in the fetched status or after a successful click)
  if (booking.status === "cancelled" || cancelled) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Booking cancelled</h1>
        <p className="mt-2 text-muted-foreground">
          This booking has already been cancelled.
        </p>
        <BackLink href={venueHref} />
      </Centered>
    )
  }

  async function handleCancel() {
    setIsCancelling(true)
    setError(null)
    try {
      await cancelBooking({ id: bookingId, cancelToken: token })
      setCancelled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsCancelling(false)
    }
  }

  const isInvalidTokenError =
    error !== null && error.includes("Invalid or missing cancel token")

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Cancel this booking?</h1>
        <p className="mt-1 text-muted-foreground">
          This action cannot be undone.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Date</span>
          <span className="text-sm font-medium">{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Time</span>
          <span className="text-sm font-medium">
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
        <TherapistLine therapistId={booking.therapistId} />
      </Card>

      {isInvalidTokenError ? (
        <p className="text-center text-sm text-destructive">
          This cancel link is invalid. Use the link from your booking email.
        </p>
      ) : error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : null}

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleCancel}
        disabled={isCancelling}
      >
        {isCancelling ? "Cancelling..." : "Cancel booking"}
      </Button>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-12 text-center">{children}</div>
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="mt-6 inline-block text-sm underline">
      Back to venue
    </Link>
  )
}

function TherapistLine({ therapistId }: { therapistId: string }) {
  const user = useQuery(usersGetPublic, { id: therapistId })
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Therapist</span>
      <span className="text-sm font-medium">{user?.name ?? "..."}</span>
    </div>
  )
}

function formatDate(date: string): string {
  const parts = date.split("-")
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  })
}

function formatTime(time: string): string {
  const parts = time.split(":")
  const h = Number(parts[0])
  const minutes = parts[1] ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
```

Notes:
- `useSearchParams` without a Suspense boundary opts the route into dynamic rendering. This matches the existing `confirm-page.tsx` pattern in the same app; these booking routes are inherently dynamic, so no Suspense wrapper is required.
- `token` is a `const` binding narrowed by the `if (!token) return …` guard, so it is a `string` inside `handleCancel` — no non-null assertion needed.

- [ ] **Step 3: Typecheck**

```
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add "apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/cancel"
git commit -m "feat(web): add customer cancel-by-token route"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full backend typecheck + tests**

```
pnpm --filter @openschedule/convex typecheck
pnpm --filter @openschedule/convex test
```

Expected: typecheck PASS; all tests PASS (including the new `cancelWithToken`, `cancel` auth, and `create` token tests; the two updated existing tests).

- [ ] **Step 2: Full frontend typecheck**

```
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 3: Lint**

```
pnpm lint
```

Expected: PASS (no new violations in `packages/convex` or `apps/web`).

- [ ] **Step 4: Manual UI verification (requires running `next dev` for `apps/web` + `convex dev`, both user-managed)**

Using the **next-dev-loop** and/or **agent-browser** skills, with the user confirming the dev servers are running, verify each cancel-page state against a real booking:

1. **Missing token** — visit `/:org/:venue/bookings/:id/cancel` (no `?token=`) → "Invalid cancel link" state.
2. **Wrong token** — append `?token=garbage` → page loads summary; click "Cancel booking" → "invalid cancel link" error message.
3. **Valid token** — copy the real token from the booking-created email (dev mode logs it to the Convex logs since `RESEND_API_KEY` is unset) → click "Cancel booking" → success/already-cancelled state; booking shows `cancelled` in the admin app.
4. **Already cancelled** — reload the same valid-token URL → "already been cancelled" state, no button.
5. **View page** — open `/:org/:venue/bookings/:id`; confirm there is no cancel button, only the "use the link in your email" note.

> To find the real `cancelToken` for manual testing without email: read it directly from the Convex dashboard for the booking document, or run a one-off query in the Convex dashboard. The token is only ever delivered via email at runtime.

- [ ] **Step 5: Final commit if any verification fixes were made**

```
git status
```

If clean, done. Otherwise stage and commit with an appropriate semantic message.

---

## Spec coverage checklist

- `cancelToken` field added (schema) → Task 1.
- `performCancel` shared helper → Task 2.
- `cancel` auth gap closed → Task 2 (+ new auth test + 2 updated tests).
- `cancelWithToken` public mutation + all four spec test cases (valid / wrong / already-cancelled / not-found) → Task 3.
- Organization internal resolver for `orgSlug` → Task 4.
- `sendBookingCreatedEmail` action (view + cancel links, `WEB_URL`, org email gate, customer-only recipient) → Task 5.
- `create` sets token + schedules created email (+ test) → Task 5.
- View page loses cancel affordance + gains email note → Task 6.
- Cancel route with confirm step and all spec states (missing token, not found, already cancelled, active+confirm, success, invalid-token error) → Task 7.
- Error-handling table from the spec is covered by the mutation throws + UI states across Tasks 2, 3, 5, 7.

## Out of scope (per spec — do not implement)

Confirm-by-link (`pending`→`confirmed`), `.ics` / "Add to Google Calendar", cancellation reason, time-based cutoffs, Google Calendar integration, customer accounts/auth.
