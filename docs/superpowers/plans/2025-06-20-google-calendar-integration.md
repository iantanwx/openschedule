# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync confirmed bookings to therapists' Google Calendars via OAuth integration.

**Architecture:** Next.js API routes handle the OAuth flow (authorize + callback). Tokens stored in the existing Convex `integrations` table. A Convex internal action `syncCalendarEvent` is scheduled from booking mutations (confirm/cancel/reschedule) and calls the Google Calendar REST API with raw fetch. Token refresh is inline. Failures are fire-and-forget.

**Tech Stack:** Convex (backend), Next.js 16 API routes (OAuth), Google Calendar REST API v3 (raw fetch), shadcn/ui (frontend)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/convex/src/schema.ts` | Add `googleCalendarEventId` to bookings |
| `packages/convex/src/queries/integrations.ts` | Public query: get user's integration status |
| `packages/convex/src/mutations/integrations.ts` | upsert, disconnect (public), updateConfig (internal) |
| `packages/convex/src/actions/lib/googleCalendar.ts` | Token refresh + Google Calendar API helpers |
| `packages/convex/src/actions/syncCalendarEvent.ts` | Internal action: create/delete calendar events |
| `packages/convex/src/mutations/bookings.ts` | Wire scheduler calls for calendar sync |
| `packages/convex/src/lib/bookings.ts` | Wire scheduler call for cancel sync |
| `apps/admin/app/api/integrations/google/authorize/route.ts` | OAuth: build URL + redirect |
| `apps/admin/app/api/integrations/google/callback/route.ts` | OAuth: exchange code + store tokens |
| `apps/admin/app/(protected)/account/page.tsx` | Global account settings route |
| `apps/admin/components/account-page.tsx` | Account page UI (profile + integrations) |
| `apps/admin/components/top-bar.tsx` | Add avatar dropdown with Account link |
| `apps/admin/lib/convex-api.ts` | Add integrations type entries |

---

### Task 1: Add googleCalendarEventId to bookings schema

**Files:**
- Modify: `packages/convex/src/schema.ts:83-108`

- [ ] **Step 1: Add the field**

In `packages/convex/src/schema.ts`, inside the `bookings` defineTable object, add after `serviceId`:

```typescript
googleCalendarEventId: v.optional(v.string()),
```

The bookings table block should now end with:
```typescript
    serviceId: v.optional(v.id("services")),
    googleCalendarEventId: v.optional(v.string()),
  })
```

- [ ] **Step 2: Run codegen**

Run from `packages/convex`:
```bash
pnpm dlx convex codegen
```
Expected: completes without error.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```
Expected: only the 2 pre-existing errors (`auth.ts:14`, `triggers.ts:3`).

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/schema.ts
git commit -m "feat(convex): add googleCalendarEventId to bookings schema"
```

---

### Task 2: Integrations queries and mutations

**Files:**
- Create: `packages/convex/src/queries/integrations.ts`
- Create: `packages/convex/src/mutations/integrations.ts`
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Create the query**

Create `packages/convex/src/queries/integrations.ts`:

```typescript
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const getByCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    if (!integration) return null;

    return {
      _id: integration._id,
      provider: integration.provider,
      enabled: integration.enabled,
      connectedAt: integration._creationTime,
    };
  },
});
```

- [ ] **Step 2: Create the mutations**

Create `packages/convex/src/mutations/integrations.ts`:

```typescript
import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const upsert = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    const config = {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        config,
        enabled: true,
        version: 1,
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      scope: "user",
      scopeId: user._id,
      provider: "google-calendar",
      version: 1,
      config,
      enabled: true,
    });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    if (!integration) {
      throw new Error("No Google Calendar integration found");
    }

    await ctx.db.patch(integration._id, { enabled: false });
  },
});

export const updateConfig = internalMutation({
  args: {
    id: v.id("integrations"),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { config: args.config });
  },
});

export const disable = internalMutation({
  args: { id: v.id("integrations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { enabled: false });
  },
});
```

- [ ] **Step 3: Add types to convex-api.ts**

In `apps/admin/lib/convex-api.ts`, add inside the `queries` object (after the `services` block):

```typescript
    integrations: {
      getByCurrentUser: FunctionReference<"query", "public", Record<string, never>, {
        _id: string;
        provider: string;
        enabled: boolean;
        connectedAt: number;
      } | null>;
    };
```

And inside the `mutations` object (after the `settings` block):

```typescript
    integrations: {
      upsert: FunctionReference<"mutation", "public", {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }, string>;
      disconnect: FunctionReference<"mutation", "public", Record<string, never>, void>;
    };
```

- [ ] **Step 4: Codegen + typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen && cd ../..
pnpm --filter @openschedule/convex typecheck
pnpm --filter admin typecheck
```
Expected: only the 2 pre-existing errors in each.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/queries/integrations.ts packages/convex/src/mutations/integrations.ts apps/admin/lib/convex-api.ts
git commit -m "feat(convex): add integrations queries and mutations"
```

---

### Task 3: Google Calendar helper functions

**Files:**
- Create: `packages/convex/src/actions/lib/googleCalendar.ts`

- [ ] **Step 1: Create the helper module**

Create `packages/convex/src/actions/lib/googleCalendar.ts`:

```typescript
"use node";

import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

interface TokenConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface Integration {
  _id: string;
  config: TokenConfig;
  enabled: boolean;
}

interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Refresh the access token if expired or close to expiry (within 60s).
 * Returns the current (or refreshed) access token.
 * Throws if refresh fails (caller should catch and disable integration).
 */
export async function refreshTokenIfNeeded(
  ctx: ActionCtx,
  integration: Integration,
): Promise<string> {
  const config = integration.config;
  const now = Date.now();

  // If token is still valid (more than 60s remaining), return it
  if (config.expiresAt - now > 60_000) {
    return config.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const newConfig: TokenConfig = {
    accessToken: data.access_token,
    refreshToken: config.refreshToken, // Google doesn't always return a new refresh token
    expiresAt: now + data.expires_in * 1000,
  };

  // Persist the refreshed token
  await ctx.runMutation(internal.mutations.integrations.updateConfig, {
    id: integration._id as any,
    config: newConfig,
  });

  return newConfig.accessToken;
}

/**
 * Create a calendar event on the user's primary calendar.
 * Returns the event ID.
 */
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent,
): Promise<string> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Calendar create event failed (${response.status}): ${errorBody}`,
    );
  }

  const result = await response.json();
  return result.id;
}

/**
 * Delete a calendar event from the user's primary calendar.
 * Silently succeeds if the event is already deleted (410 Gone).
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  // 204 = success, 410 = already deleted — both are fine
  if (!response.ok && response.status !== 410) {
    const errorBody = await response.text();
    throw new Error(
      `Google Calendar delete event failed (${response.status}): ${errorBody}`,
    );
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```
Expected: only the 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/actions/lib/googleCalendar.ts
git commit -m "feat(convex): add Google Calendar API helper functions"
```

---

### Task 4: syncCalendarEvent action

**Files:**
- Create: `packages/convex/src/actions/syncCalendarEvent.ts`

- [ ] **Step 1: Create the action**

Create `packages/convex/src/actions/syncCalendarEvent.ts`:

```typescript
"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  refreshTokenIfNeeded,
  createCalendarEvent,
  deleteCalendarEvent,
} from "./lib/googleCalendar";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    action: v.union(v.literal("create"), v.literal("delete")),
  },
  handler: async (ctx, args) => {
    // 1. Load booking
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(`[CALENDAR] Booking ${args.bookingId} not found, skipping`);
      return;
    }

    // 2. Load therapist's integration
    const integration = await ctx.runQuery(
      internal.queries.internal.integrations.getInternal,
      { userId: booking.therapistId },
    );
    if (!integration || !integration.enabled) {
      return; // No integration or disabled — silently skip
    }

    // 3. Refresh token
    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(ctx, integration);
    } catch (error) {
      console.error(`[CALENDAR] Token refresh failed for therapist ${booking.therapistId}:`, error);
      // Disable the integration (token likely revoked)
      await ctx.runMutation(internal.mutations.integrations.disable, {
        id: integration._id,
      });
      return;
    }

    // 4. Execute the action
    if (args.action === "create") {
      try {
        // Resolve additional data for event content
        const customer = await ctx.runQuery(
          internal.queries.internal.customers.getInternal,
          { id: booking.customerId },
        );
        const venue = await ctx.runQuery(
          internal.queries.internal.venues.getInternal,
          { id: booking.venueId },
        );

        let serviceName = "";
        if (booking.serviceId) {
          const service = await ctx.runQuery(
            internal.queries.internal.services.getInternal,
            { id: booking.serviceId },
          );
          if (service) {
            serviceName = service.name;
          }
        }

        const customerName = customer?.name ?? "Unknown";
        const summary = serviceName
          ? `Booking: ${customerName} — ${serviceName}`
          : `Booking: ${customerName}`;

        const description = [
          `Customer: ${customerName}`,
          `Email: ${customer?.email ?? "Not provided"}`,
          `Phone: ${customer?.phone ?? "Not provided"}`,
        ].join("\n");

        const timezone = venue?.timezone ?? "UTC";
        const startDateTime = `${booking.date}T${booking.startTime}:00`;
        const endDateTime = `${booking.date}T${booking.endTime}:00`;

        const eventId = await createCalendarEvent(accessToken, {
          summary,
          description,
          start: { dateTime: startDateTime, timeZone: timezone },
          end: { dateTime: endDateTime, timeZone: timezone },
        });

        // Store the event ID on the booking
        await ctx.runMutation(
          internal.mutations.internal.bookings.setGoogleCalendarEventId,
          { bookingId: args.bookingId, eventId },
        );
      } catch (error) {
        console.error(`[CALENDAR] Failed to create event for booking ${args.bookingId}:`, error);
        // Fire-and-forget: don't throw, booking is unaffected
      }
    } else if (args.action === "delete") {
      const eventId = booking.googleCalendarEventId;
      if (!eventId) {
        return; // No event to delete
      }

      try {
        await deleteCalendarEvent(accessToken, eventId);
        // Clear the event ID
        await ctx.runMutation(
          internal.mutations.internal.bookings.setGoogleCalendarEventId,
          { bookingId: args.bookingId, eventId: null },
        );
      } catch (error) {
        console.error(`[CALENDAR] Failed to delete event for booking ${args.bookingId}:`, error);
        // Fire-and-forget
      }
    }
  },
});
```

- [ ] **Step 2: Create internal integrations query**

Create `packages/convex/src/queries/internal/integrations.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", args.userId).eq("provider", "google-calendar"),
      )
      .unique();
  },
});
```

- [ ] **Step 3: Create internal services query**

Create `packages/convex/src/queries/internal/services.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 4: Create internal bookings mutation for eventId**

Create `packages/convex/src/mutations/internal/bookings.ts`:

```typescript
import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

export const setGoogleCalendarEventId = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    eventId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, string | undefined> = {};
    if (args.eventId === null) {
      update.googleCalendarEventId = undefined;
    } else {
      update.googleCalendarEventId = args.eventId;
    }
    await ctx.db.patch(args.bookingId, update);
  },
});
```

- [ ] **Step 5: Codegen + typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen && cd ../..
pnpm --filter @openschedule/convex typecheck
```
Expected: only the 2 pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/actions/syncCalendarEvent.ts packages/convex/src/queries/internal/integrations.ts packages/convex/src/queries/internal/services.ts packages/convex/src/mutations/internal/bookings.ts
git commit -m "feat(convex): add syncCalendarEvent action with helpers"
```

---

### Task 5: Wire booking mutations to schedule calendar sync

**Files:**
- Modify: `packages/convex/src/mutations/bookings.ts:117-145` (confirm)
- Modify: `packages/convex/src/lib/bookings.ts` (performCancel)
- Modify: `packages/convex/src/mutations/bookings.ts:180-261` (reschedule)

- [ ] **Step 1: Wire confirm**

In `packages/convex/src/mutations/bookings.ts`, the `confirm` handler currently ends with:

```typescript
    await ctx.db.patch(args.id, { status: "confirmed" });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "confirmed",
    });
```

Add after the sendBookingNotification scheduler call:

```typescript
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "create",
    });
```

- [ ] **Step 2: Wire performCancel**

In `packages/convex/src/lib/bookings.ts`, the function currently ends with:

```typescript
  await ctx.scheduler.runAfter(
    0,
    internal.actions.sendBookingNotification.send,
    { bookingId, event: "cancelled" },
  );
```

Add after it:

```typescript
  await ctx.scheduler.runAfter(
    0,
    internal.actions.syncCalendarEvent.send,
    { bookingId, action: "delete" },
  );
```

Also add the import at the top — the file already imports `internal` from `"../_generated/api"`, so this should work with the existing import. Verify that `internal.actions.syncCalendarEvent` resolves after codegen.

- [ ] **Step 3: Wire reschedule**

In `packages/convex/src/mutations/bookings.ts`, the `reschedule` handler currently ends with:

```typescript
    await ctx.db.patch(args.id, {
      date: args.newDate,
      startTime: args.newStartTime,
      endTime: args.newEndTime,
    });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "rescheduled",
    });
```

Add after the sendBookingNotification scheduler call:

```typescript
    // Delete old calendar event, then create new one with updated times
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "delete",
    });
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "create",
    });
```

Note: The "delete" action reads `googleCalendarEventId` from the booking doc. The "create" action reads the updated date/times. Both run asynchronously after the mutation commits, and Convex executes scheduled functions in order, so "delete" will fire before "create". The delete clears the eventId, then create sets a new one.

- [ ] **Step 4: Codegen + typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen && cd ../..
pnpm --filter @openschedule/convex typecheck
```
Expected: only the 2 pre-existing errors.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @openschedule/convex test
```
Expected: 45/45 passing. The new scheduler calls will add more benign `_scheduled_functions` unhandled rejections — that's expected.

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/mutations/bookings.ts packages/convex/src/lib/bookings.ts
git commit -m "feat(convex): wire calendar sync to confirm, cancel, and reschedule"
```

---

### Task 6: OAuth API routes

**Files:**
- Create: `apps/admin/app/api/integrations/google/authorize/route.ts`
- Create: `apps/admin/app/api/integrations/google/callback/route.ts`

- [ ] **Step 1: Create the authorize route**

Create `apps/admin/app/api/integrations/google/authorize/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  const redirectUri = `${appUrl}/api/integrations/google/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID not configured" },
      { status: 500 },
    );
  }

  // Generate CSRF state token
  const state = crypto.randomUUID();

  // Store state in HTTP-only cookie (expires in 10 minutes)
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(googleAuthUrl);
}
```

- [ ] **Step 2: Create the callback route**

Create `apps/admin/app/api/integrations/google/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchMutation } from "convex/nextjs";
import { api } from "@openschedule/convex/api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  const accountUrl = `${appUrl}/account`;

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    return NextResponse.redirect(`${accountUrl}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${accountUrl}?error=missing_params`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${accountUrl}?error=invalid_state`);
  }

  // Clear the state cookie
  cookieStore.delete("google_oauth_state");

  // Exchange code for tokens
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/integrations/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${accountUrl}?error=server_config`);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("[GOOGLE OAUTH] Token exchange failed:", errorBody);
    return NextResponse.redirect(`${accountUrl}?error=token_exchange`);
  }

  const tokenData = await tokenResponse.json();

  // Get the auth token from the request cookies to authenticate the Convex mutation
  const authToken = request.cookies.get("better-auth.session_token")?.value;

  if (!authToken) {
    return NextResponse.redirect(`${accountUrl}?error=not_authenticated`);
  }

  // Store tokens in Convex
  try {
    await fetchMutation(
      api.mutations.integrations.upsert as any,
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      },
      { token: authToken },
    );
  } catch (err) {
    console.error("[GOOGLE OAUTH] Failed to store tokens:", err);
    return NextResponse.redirect(`${accountUrl}?error=storage_failed`);
  }

  return NextResponse.redirect(`${accountUrl}?connected=google-calendar`);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter admin typecheck
```
Expected: only the 2 pre-existing errors. If `fetchMutation` from `convex/nextjs` is not recognized, check that `convex` is in the admin app's dependencies (it should be via the workspace).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/api/integrations/google/authorize/route.ts apps/admin/app/api/integrations/google/callback/route.ts
git commit -m "feat(admin): add Google OAuth authorize and callback API routes"
```

---

### Task 7: Account page

**Files:**
- Create: `apps/admin/app/(protected)/account/page.tsx`
- Create: `apps/admin/components/account-page.tsx`

- [ ] **Step 1: Create the route page**

Create `apps/admin/app/(protected)/account/page.tsx`:

```typescript
import { AccountPage } from "@/components/account-page";

export default function AccountRoute() {
  return <AccountPage />;
}
```

- [ ] **Step 2: Create the account page component**

Create `apps/admin/components/account-page.tsx`:

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { useSession } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { useSearchParams } from "next/navigation";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import { Badge } from "@openschedule/ui/components/badge";
import { TopBar } from "./top-bar";

export function AccountPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const integration = useQuery(convexApi.queries.integrations.getByCurrentUser);
  const disconnectMutation = useMutation(convexApi.mutations.integrations.disconnect);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleDisconnect() {
    await disconnectMutation();
  }

  function handleConnect() {
    window.location.href = "/api/integrations/google/authorize";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Account Settings</h1>

        {/* Success/error banners */}
        {connected === "google-calendar" && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Google Calendar connected successfully.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Failed to connect Google Calendar. Please try again.
          </div>
        )}

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{userName}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </CardContent>
        </Card>

        {/* Integrations Section */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V8.25h15v11.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    Sync confirmed bookings to your calendar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration?.enabled ? (
                  <>
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      Connected
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleConnect}>
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter admin typecheck
```
Expected: only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/(protected)/account/page.tsx apps/admin/components/account-page.tsx
git commit -m "feat(admin): add global account settings page with Google Calendar integration"
```

---

### Task 8: TopBar avatar dropdown

**Files:**
- Modify: `apps/admin/components/top-bar.tsx`

- [ ] **Step 1: Update the TopBar component**

Replace the entire content of `apps/admin/components/top-bar.tsx` with:

```typescript
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization } from "@/lib/auth-client";
import { useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { VenueSwitcher } from "./venue-switcher";
import { ChevronRight, Settings, LogOut } from "lucide-react";

export function TopBar() {
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-1.5">
        <Link href={`/${orgSlug}`} className="text-sm font-semibold hover:text-foreground/80">
          {orgName}
        </Link>
        {venue && venueSlug && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <VenueSwitcher
              orgId={org?._id ?? ""}
              orgSlug={orgSlug}
              currentVenueName={venue.name}
            />
          </>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter admin typecheck
```
Expected: only the 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/top-bar.tsx
git commit -m "feat(admin): add avatar dropdown menu with account settings link"
```

---

### Task 9: Tests

**Files:**
- Modify: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Verify existing tests still pass**

```bash
pnpm --filter @openschedule/convex test
```
Expected: 45/45 passing. The new `syncCalendarEvent` scheduler calls will produce additional benign `_scheduled_functions` unhandled rejections — that's expected and fine.

- [ ] **Step 2: Add test for googleCalendarEventId field**

Add the following test inside the existing `describe("booking mutations", ...)` block in `packages/convex/src/tests/bookings.test.ts`:

```typescript
  test("googleCalendarEventId is undefined by default on new bookings", async () => {
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
        roles: ["therapist"],
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
      date: "2025-01-15",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const booking = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId);
      if (b && "googleCalendarEventId" in b) {
        return b.googleCalendarEventId;
      }
      return undefined;
    });

    expect(booking).toBeUndefined();
  });
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @openschedule/convex exec vitest run src/tests/bookings.test.ts
```
Expected: all tests pass (now 17 in this file — 16 existing + 1 new).

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/tests/bookings.test.ts
git commit -m "test(convex): verify googleCalendarEventId is undefined on new bookings"
```

---

### Task 10: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Typecheck all packages**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter admin typecheck
pnpm --filter web typecheck
```
Expected: only the 2 pre-existing errors in each.

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @openschedule/convex test
```
Expected: 46/46 passing (45 original + 1 new). Exit code 1 from benign `_scheduled_functions` rejections only.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```
Expected: no new errors in touched files. Pre-existing lint noise in untouched files is fine.

- [ ] **Step 4: E2E verification (manual, via agent-browser)**

Prerequisites:
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on the admin app (in `.env.local` or similar)
- Set the same vars on the Convex deployment (for the action)
- Configure Google Cloud Console with redirect URI: `http://localhost:3001/api/integrations/google/callback`

Steps:
1. Navigate to `http://localhost:3001` → log in as owner
2. Click avatar dropdown → "Account Settings" → verify `/account` page renders
3. Click "Connect" → should redirect to Google consent screen
4. Authorize → should redirect back to `/account?connected=google-calendar`
5. Verify "Connected" badge appears
6. Create a booking and confirm it → check therapist's Google Calendar for the event
7. Cancel the booking → verify the calendar event is deleted
8. Click "Disconnect" → verify badge changes, future confirms don't create events

Note: E2E requires real Google OAuth credentials. For local testing without credentials, the action will bail silently (no GOOGLE_CLIENT_ID → refreshTokenIfNeeded throws → action catches and disables → no event created). The connect flow will show an error page.
