# In-App Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time in-app notifications (bell icon + toasts) to the admin app for booking and team events.

**Architecture:** A `notifications` table in Convex stores notification docs per recipient. Convex's reactive `useQuery` pushes new notifications to the UI instantly. Notification creation is synchronous inside existing mutations (same transaction). `sonner` provides toast UI.

**Tech Stack:** Convex (backend + real-time), Next.js 16 (admin app), sonner (toasts), lucide-react (icons), shadcn Popover component.

---

## Baseline

- **Typecheck PASS** = only 2 pre-existing errors (`auth.ts:14 authComponent`, `triggers.ts:3 onCreate`)
- **Tests:** 46/46 passing. Command: `pnpm --filter @openschedule/convex test`
- **Codegen:** `pnpm dlx convex codegen` (workdir: `packages/convex`)
- **Admin typecheck:** `pnpm --filter admin typecheck`
- **Convex typecheck:** `pnpm --filter @openschedule/convex typecheck`
- **Branch:** `feat/notification-system` from master
- **Rules:** No `!` non-null assertions. pnpm only. Semantic commits. Never start dev servers. `_generated/` is gitignored.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/convex/src/schema.ts` | Modify | Add `notifications` table |
| `packages/convex/src/lib/notifications.ts` | Create | `createNotification` + `createNotificationsForOwners` helpers |
| `packages/convex/src/queries/notifications.ts` | Create | `listRecent` + `unreadCount` |
| `packages/convex/src/mutations/notifications.ts` | Create | `markRead` + `markAllRead` |
| `packages/convex/src/mutations/bookings.ts` | Modify | Insert notifications on create/reschedule |
| `packages/convex/src/lib/bookings.ts` | No change | `performCancel` unchanged; callers handle notifications |
| `packages/convex/src/betterAuth/auth.ts` | Modify | Insert notifications on member.onCreate |
| `apps/admin/lib/convex-api.ts` | Modify | Add notification query/mutation types |
| `apps/admin/lib/format-notification.ts` | Create | Type+payload → icon+text mapping |
| `apps/admin/components/notification-bell.tsx` | Create | Bell icon + badge + Popover |
| `apps/admin/components/notification-list.tsx` | Create | Scrollable notification items |
| `apps/admin/components/notification-toast.tsx` | Create | useEffect that fires sonner toasts on new notifications |
| `apps/admin/components/top-bar.tsx` | Modify | Add NotificationBell |
| `apps/admin/components/mobile-top-bar.tsx` | Modify | Add NotificationBell |
| `apps/admin/app/(protected)/layout.tsx` | Modify | Add NotificationToast |
| `apps/admin/app/layout.tsx` | Modify (if needed) | Add sonner Toaster |

---

### Task 1: Add notifications table to schema

**Files:**
- Modify: `packages/convex/src/schema.ts:131-133`

- [ ] **Step 1: Add the notifications table**

Insert after line 131 (end of `integrations` indexes) and before line 133 (`users` table):

```typescript
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
    .index("by_recipientId_and_read", ["recipientId", "read"]),
```

- [ ] **Step 2: Run codegen**

```bash
cd packages/convex && pnpm dlx convex codegen
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/schema.ts
git commit -m "feat(convex): add notifications table to schema"
```

---

### Task 2: Create notification helper library

**Files:**
- Create: `packages/convex/src/lib/notifications.ts`

- [ ] **Step 1: Create the helper file**

```typescript
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type NotificationType =
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "therapist_joined";

/**
 * Insert a single notification for one recipient.
 */
export async function createNotification(
  ctx: MutationCtx,
  args: {
    recipientId: Id<"users">;
    type: NotificationType;
    orgId: Id<"organizations">;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("notifications", {
    recipientId: args.recipientId,
    type: args.type,
    orgId: args.orgId,
    payload: args.payload,
    read: false,
    createdAt: Date.now(),
  });
}

/**
 * Insert notifications for all owners in an org.
 * Optionally exclude a user (the actor — "don't notify yourself").
 */
export async function createNotificationsForOwners(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    type: NotificationType;
    payload: Record<string, unknown>;
    excludeUserId?: Id<"users">;
  },
): Promise<void> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
    .take(50);
  const owners = users.filter(
    (u) => u.roles?.includes("owner") && u._id !== args.excludeUserId,
  );
  for (const owner of owners) {
    await createNotification(ctx, {
      recipientId: owner._id,
      type: args.type,
      orgId: args.orgId,
      payload: args.payload,
    });
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/lib/notifications.ts
git commit -m "feat(convex): add notification creation helpers"
```

---

### Task 3: Create notification queries

**Files:**
- Create: `packages/convex/src/queries/notifications.ts`

- [ ] **Step 1: Create the queries file**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit ?? 20;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", user._id),
      )
      .order("desc")
      .take(limit);
    return notifications;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_read", (q) =>
        q.eq("recipientId", user._id).eq("read", false),
      )
      .take(100);
    return unread.length;
  },
});
```

- [ ] **Step 2: Run codegen + typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/notifications.ts
git commit -m "feat(convex): add notification queries (listRecent, unreadCount)"
```

---

### Task 4: Create notification mutations

**Files:**
- Create: `packages/convex/src/mutations/notifications.ts`

- [ ] **Step 1: Create the mutations file**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.recipientId.toString() !== user._id.toString()) {
      throw new Error("Not your notification");
    }
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_read", (q) =>
        q.eq("recipientId", user._id).eq("read", false),
      )
      .take(100);
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
```

- [ ] **Step 2: Run codegen + typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/mutations/notifications.ts
git commit -m "feat(convex): add notification mutations (markRead, markAllRead)"
```

---

### Task 5: Wire notification creation into existing mutations

**Files:**
- Modify: `packages/convex/src/mutations/bookings.ts`
- Modify: `packages/convex/src/betterAuth/auth.ts`

- [ ] **Step 1: Add notification imports to bookings.ts**

At the top of `packages/convex/src/mutations/bookings.ts`, add after the existing imports (after line 7 `import { hasRole, Role } from "../lib/roles";`):

```typescript
import { createNotification, createNotificationsForOwners } from "../lib/notifications";
```

- [ ] **Step 2: Insert notifications in `create` mutation**

In the `create` handler, after the `syncCalendarEvent` scheduler call (after `{ bookingId, action: "create" }`), add:

```typescript
    // In-app notifications
    const customer = await ctx.db.get(args.customerId);
    const service = args.serviceId ? await ctx.db.get(args.serviceId) : null;
    const notifPayload = {
      bookingId,
      customerName: customer?.name ?? "Unknown",
      date: args.date,
      startTime: args.startTime,
      serviceName: service?.name ?? "Appointment",
    };

    // Determine if creator should be excluded (admin-created bookings)
    let excludeUserId: typeof args.therapistId | undefined;
    if (args.createdBy === "owner" || args.createdBy === "therapist") {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const actorUser = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
          .unique();
        if (actorUser) {
          excludeUserId = actorUser._id;
        }
      }
    }

    // Notify the assigned therapist (unless they created it themselves)
    if (args.therapistId !== excludeUserId) {
      await createNotification(ctx, {
        recipientId: args.therapistId,
        type: "booking_created",
        orgId: venue.orgId,
        payload: notifPayload,
      });
    }

    // Notify all owners (excluding the actor if they're an owner)
    await createNotificationsForOwners(ctx, {
      orgId: venue.orgId,
      type: "booking_created",
      payload: notifPayload,
      excludeUserId,
    });
```

- [ ] **Step 3: Insert notifications in `cancel` mutation (auth-guarded)**

In the `cancel` mutation handler, after `await performCancel(ctx, args.id);` (line 162), add:

```typescript
    // In-app notifications for cancellation
    const cancelledBooking = await ctx.db.get(args.id);
    if (cancelledBooking) {
      const cancelCustomer = await ctx.db.get(cancelledBooking.customerId);
      const cancelVenue = await ctx.db.get(cancelledBooking.venueId);
      const cancelPayload = {
        bookingId: args.id,
        customerName: cancelCustomer?.name ?? "Unknown",
        date: cancelledBooking.date,
        startTime: cancelledBooking.startTime,
      };
      if (cancelVenue) {
        if (cancelledBooking.therapistId !== user._id) {
          await createNotification(ctx, {
            recipientId: cancelledBooking.therapistId,
            type: "booking_cancelled",
            orgId: cancelVenue.orgId,
            payload: cancelPayload,
          });
        }
        await createNotificationsForOwners(ctx, {
          orgId: cancelVenue.orgId,
          type: "booking_cancelled",
          payload: cancelPayload,
          excludeUserId: user._id,
        });
      }
    }
```

- [ ] **Step 4: Insert notifications in `cancelWithToken` (customer-initiated)**

In the `cancelWithToken` mutation handler, after `await performCancel(ctx, args.id);` (line 185), add:

```typescript
    // In-app notifications — customer cancelled, notify everyone
    const tokenCancelledBooking = await ctx.db.get(args.id);
    if (tokenCancelledBooking) {
      const tokenCustomer = await ctx.db.get(tokenCancelledBooking.customerId);
      const tokenVenue = await ctx.db.get(tokenCancelledBooking.venueId);
      const tokenPayload = {
        bookingId: args.id,
        customerName: tokenCustomer?.name ?? "Unknown",
        date: tokenCancelledBooking.date,
        startTime: tokenCancelledBooking.startTime,
      };
      if (tokenVenue) {
        await createNotification(ctx, {
          recipientId: tokenCancelledBooking.therapistId,
          type: "booking_cancelled",
          orgId: tokenVenue.orgId,
          payload: tokenPayload,
        });
        await createNotificationsForOwners(ctx, {
          orgId: tokenVenue.orgId,
          type: "booking_cancelled",
          payload: tokenPayload,
        });
      }
    }
```

- [ ] **Step 5: Insert notifications in `reschedule`**

In the `reschedule` handler, after the calendar sync calls (after line 277 `action: "create"`), add:

```typescript
    // In-app notification for reschedule
    const rescheduledBooking = await ctx.db.get(args.id);
    if (rescheduledBooking) {
      const reschCustomer = await ctx.db.get(rescheduledBooking.customerId);
      const reschPayload = {
        bookingId: args.id,
        customerName: reschCustomer?.name ?? "Unknown",
        newDate: args.newDate,
        newStartTime: args.newStartTime,
        rescheduledBy: user.name,
      };
      // Notify the assigned therapist only if actor is different
      if (rescheduledBooking.therapistId !== user._id) {
        await createNotification(ctx, {
          recipientId: rescheduledBooking.therapistId,
          type: "booking_rescheduled",
          orgId: venue.orgId,
          payload: reschPayload,
        });
      }
      // Notify owners (excluding the actor)
      await createNotificationsForOwners(ctx, {
        orgId: venue.orgId,
        type: "booking_rescheduled",
        payload: reschPayload,
        excludeUserId: user._id,
      });
    }
```

- [ ] **Step 6: Insert notifications in `member.onCreate` trigger**

In `packages/convex/src/betterAuth/auth.ts`, add the import at the top of the file (after other imports from `../lib/`):

```typescript
import { createNotificationsForOwners } from "../lib/notifications";
```

Then in the `member.onCreate` handler, after the service auto-assign loop (after the `for (const service of activeServices) { ... }` block), add:

```typescript
          // Notify owners about new therapist
          if (newRole === "therapist") {
            await createNotificationsForOwners(ctx, {
              orgId: org._id,
              type: "therapist_joined",
              payload: {
                therapistName: user.name,
                therapistId: user._id,
              },
            });
          }
```

- [ ] **Step 7: Run codegen + typecheck + tests**

```bash
cd packages/convex && pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
pnpm --filter @openschedule/convex test
```

Expected: typecheck has only 2 pre-existing errors; 46/46 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/convex/src/mutations/bookings.ts packages/convex/src/betterAuth/auth.ts
git commit -m "feat(convex): wire notification creation into booking and member mutations"
```

---

### Task 6: Admin frontend — convex-api types + format helper + bell + list

**Files:**
- Modify: `apps/admin/lib/convex-api.ts`
- Create: `apps/admin/lib/format-notification.ts`
- Create: `apps/admin/components/notification-bell.tsx`
- Create: `apps/admin/components/notification-list.tsx`

- [ ] **Step 1: Add notification types to convex-api.ts**

In `apps/admin/lib/convex-api.ts`, add in the `queries` section (before the closing `};` of queries):

```typescript
    notifications: {
      listRecent: FunctionReference<"query", "public", { limit?: number }, Array<{
        _id: string;
        _creationTime: number;
        recipientId: string;
        type: "booking_created" | "booking_cancelled" | "booking_rescheduled" | "therapist_joined";
        orgId: string;
        payload: Record<string, unknown>;
        read: boolean;
        createdAt: number;
      }>>;
      unreadCount: FunctionReference<"query", "public", Record<string, never>, number>;
    };
```

And in the `mutations` section (before the closing `};` of mutations):

```typescript
    notifications: {
      markRead: FunctionReference<"mutation", "public", { id: string }, void>;
      markAllRead: FunctionReference<"mutation", "public", Record<string, never>, void>;
    };
```

- [ ] **Step 2: Create format-notification.ts**

Create `apps/admin/lib/format-notification.ts`:

```typescript
import { CalendarPlus, CalendarX, Clock, UserPlus } from "lucide-react";
import type { ComponentType } from "react";

export interface FormattedNotification {
  icon: ComponentType<{ className?: string }>;
  text: string;
}

type NotificationType =
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "therapist_joined";

export function formatNotification(
  type: NotificationType,
  payload: Record<string, unknown>,
): FormattedNotification {
  switch (type) {
    case "booking_created":
      return {
        icon: CalendarPlus,
        text: `New booking — ${payload.customerName}, ${payload.date} at ${payload.startTime}`,
      };
    case "booking_cancelled":
      return {
        icon: CalendarX,
        text: `Booking cancelled — ${payload.customerName}, ${payload.date} at ${payload.startTime}`,
      };
    case "booking_rescheduled":
      return {
        icon: Clock,
        text: `Booking rescheduled — ${payload.customerName}, now ${payload.newDate} at ${payload.newStartTime}`,
      };
    case "therapist_joined":
      return {
        icon: UserPlus,
        text: `${payload.therapistName} joined the team`,
      };
    default:
      return {
        icon: CalendarPlus,
        text: "New notification",
      };
  }
}
```

- [ ] **Step 3: Create notification-bell.tsx**

Create `apps/admin/components/notification-bell.tsx`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openschedule/ui/components/popover";
import { NotificationList } from "./notification-list";

export function NotificationBell() {
  const unreadCount = useQuery(convexApi.queries.notifications.unreadCount);
  const count = unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
          className="relative rounded-full p-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Create notification-list.tsx**

Create `apps/admin/components/notification-list.tsx`:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { formatNotification } from "@/lib/format-notification";
import { Button } from "@openschedule/ui/components/button";

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationList() {
  const notifications = useQuery(convexApi.queries.notifications.listRecent, { limit: 20 });
  const markRead = useMutation(convexApi.mutations.notifications.markRead);
  const markAllRead = useMutation(convexApi.mutations.notifications.markAllRead);

  if (notifications === undefined) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No notifications yet
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex max-h-96 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => markAllRead({})}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {notifications.map((notification) => {
          const { icon: Icon, text } = formatNotification(
            notification.type,
            notification.payload as Record<string, unknown>,
          );
          return (
            <button
              key={notification._id}
              onClick={() => {
                if (!notification.read) {
                  markRead({ id: notification._id });
                }
              }}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                !notification.read ? "bg-accent/50" : ""
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">{text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {relativeTime(notification.createdAt)}
                </p>
              </div>
              {!notification.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/convex-api.ts apps/admin/lib/format-notification.ts apps/admin/components/notification-bell.tsx apps/admin/components/notification-list.tsx
git commit -m "feat(admin): add notification bell, list, and format helper"
```

---

### Task 7: Toast component + wire into layouts and top bars

**Files:**
- Create: `apps/admin/components/notification-toast.tsx`
- Modify: `apps/admin/app/(protected)/layout.tsx`
- Modify: `apps/admin/app/layout.tsx` (add Toaster if needed)
- Modify: `apps/admin/components/top-bar.tsx`
- Modify: `apps/admin/components/mobile-top-bar.tsx`

- [ ] **Step 1: Create notification-toast.tsx**

Create `apps/admin/components/notification-toast.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { formatNotification } from "@/lib/format-notification";

export function NotificationToast() {
  const notifications = useQuery(convexApi.queries.notifications.listRecent, { limit: 1 });
  const lastSeenRef = useRef<number>(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Skip the initial load — only fire for genuinely new notifications
    if (!notifications || notifications.length === 0) return;

    const latest = notifications[0];
    if (!latest) return;

    if (!mountedRef.current) {
      // First render — set the baseline, don't toast
      lastSeenRef.current = latest.createdAt;
      mountedRef.current = true;
      return;
    }

    if (latest.createdAt > lastSeenRef.current) {
      lastSeenRef.current = latest.createdAt;
      const { text } = formatNotification(
        latest.type,
        latest.payload as Record<string, unknown>,
      );
      toast(text, { duration: 5000 });
    }
  }, [notifications]);

  return null;
}
```

- [ ] **Step 2: Add Toaster to root layout (if not present)**

Check `apps/admin/app/layout.tsx`. If it doesn't already have `<Toaster />` from sonner, add it. The import and component:

```tsx
import { Toaster } from "sonner";
```

Add `<Toaster />` inside the `<body>` tag, after `{children}`:

```tsx
<Toaster position="top-right" />
```

- [ ] **Step 3: Add NotificationToast to protected layout**

Modify `apps/admin/app/(protected)/layout.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";
import { NotificationToast } from "@/components/notification-toast";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <NotificationToast />
      {children}
    </>
  );
}
```

- [ ] **Step 4: Add NotificationBell to TopBar**

In `apps/admin/components/top-bar.tsx`, add the import:

```tsx
import { NotificationBell } from "./notification-bell";
```

Then in the JSX, insert `<NotificationBell />` between the left section and the avatar dropdown. Replace the right section (starting at `{/* Right: avatar dropdown */}`) with:

```tsx
      {/* Right: bell + avatar dropdown */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <DropdownMenu>
          {/* ... existing avatar dropdown unchanged ... */}
        </DropdownMenu>
      </div>
```

- [ ] **Step 5: Add NotificationBell to MobileTopBar**

In `apps/admin/components/mobile-top-bar.tsx`, add the import:

```tsx
import { NotificationBell } from "./notification-bell";
```

Then in the JSX right section (where the avatar dropdown is), wrap bell + avatar in a flex container:

```tsx
<div className="flex items-center gap-1">
  <NotificationBell />
  {/* existing avatar dropdown */}
</div>
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only the 2 pre-existing errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/components/notification-toast.tsx apps/admin/app/layout.tsx apps/admin/app/\(protected\)/layout.tsx apps/admin/components/top-bar.tsx apps/admin/components/mobile-top-bar.tsx
git commit -m "feat(admin): add notification toasts and wire bell into top bars"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run convex typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: only 2 pre-existing errors.

- [ ] **Step 2: Run admin typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @openschedule/convex test
```

Expected: 46/46 passing (or more if notification tests were added).

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: no new errors in touched files.

- [ ] **Step 5: E2E verification instructions**

With dev servers running (admin :3001, web :3000, convex dev):
1. Log in as owner → verify bell icon visible in TopBar with 0 count
2. Open customer app → book a service → admin should: toast appears + bell badge shows 1
3. Click bell → notification "New booking — {name}, {date} at {time}" appears
4. Click notification → marks as read (blue dot disappears)
5. "Mark all read" clears all
6. Cancel a booking via customer cancel link → admin: toast + new notification
7. Reschedule a booking as owner → therapist (if different user) gets notification
8. Accept a therapist invite → owners get "X joined the team" notification
