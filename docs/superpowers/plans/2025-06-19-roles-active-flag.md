# Roles Array + Active Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single `role` field with `roles` array and add `active` flag so owners can also be therapists and users can be deactivated.

**Architecture:** Create a domain-layer `Role` enum + `hasRole` helper in `packages/convex/src/lib/roles.ts`. Migrate schema from `role: string` to `roles: string[]` + `active: boolean`. Update auth layer, queries, mutations, and all frontend role checks.

**Tech Stack:** Convex (backend), Next.js 16 (admin app), vitest + convex-test

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/convex/src/lib/roles.ts` | Role enum, RoleType, hasRole helper |
| Modify | `packages/convex/src/schema.ts` | users table: roles array + active field |
| Modify | `packages/convex/src/lib/auth.ts` | AuthenticatedUser type + assertRole using hasRole |
| Modify | `packages/convex/src/queries/users.ts` | getSelf, listTherapistsByOrg, listByVenue |
| Create | `packages/convex/src/mutations/users.ts` | setActive, toggleTherapistRole mutations |
| Modify | `packages/convex/src/mutations/schedules.ts` | active check + roles-based therapist guard |
| Modify | `packages/convex/src/mutations/blockouts.ts` | active check + roles-based therapist guard |
| Modify | `packages/convex/src/mutations/bookings.ts` | roles-based owner check |
| Modify | `packages/convex/src/betterAuth/auth.ts` | triggers: roles array |
| Modify | `packages/convex/src/tests/bookings.test.ts` | Update test fixtures: role → roles |
| Modify | `apps/admin/components/team-section.tsx` | Active badge + toggle button |
| Modify | `apps/admin/components/today-page.tsx` | hasRole checks |
| Modify | `apps/admin/components/bookings-page.tsx` | hasRole checks |
| Modify | `apps/admin/components/schedule-page.tsx` | hasRole checks |
| Modify | `apps/admin/components/org-nav.tsx` | hasRole checks |
| Modify | `apps/admin/components/org-dashboard-page.tsx` | hasRole checks |
| Modify | `apps/admin/components/venue-settings-page.tsx` | hasRole checks |
| Modify | `apps/admin/lib/convex-api.ts` | New mutation type entries |

---

### Task 1: Create Role Domain Layer

**Files:**
- Create: `packages/convex/src/lib/roles.ts`

- [ ] **Step 1: Create the roles module**

```ts
// packages/convex/src/lib/roles.ts
export const Role = {
  Owner: "owner",
  Therapist: "therapist",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

/**
 * Check if a roles array includes a specific role.
 * Returns false for undefined/empty arrays.
 */
export function hasRole(roles: RoleType[] | undefined, role: RoleType): boolean {
  return roles?.includes(role) ?? false;
}

/**
 * Check if a roles array includes ANY of the specified roles.
 */
export function hasAnyRole(roles: RoleType[] | undefined, allowedRoles: RoleType[]): boolean {
  return allowedRoles.some((r) => hasRole(roles, r));
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 known pre-existing errors (auth.ts:14, triggers.ts:3)

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/lib/roles.ts
git commit -m "feat(convex): add Role enum and hasRole helper"
```

---

### Task 2: Update Schema + Auth Layer

**Files:**
- Modify: `packages/convex/src/schema.ts:108-118`
- Modify: `packages/convex/src/lib/auth.ts`

- [ ] **Step 1: Update users table schema**

In `packages/convex/src/schema.ts`, replace lines 108-118:

```ts
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("owner"), v.literal("therapist"))),
    roles: v.optional(v.array(v.union(v.literal("owner"), v.literal("therapist")))),
    active: v.optional(v.boolean()),
    orgId: v.optional(v.id("organizations")),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"])
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_role", ["orgId", "role"]),
```

Note: Keep `role` temporarily for backward compatibility during migration. Keep the `by_orgId_and_role` index until migration is complete.

- [ ] **Step 2: Update auth.ts — AuthenticatedUser type and assertRole**

Replace the full content of `packages/convex/src/lib/auth.ts`:

```ts
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { hasAnyRole, type RoleType } from "./roles";

export type AuthenticatedUser = Doc<"users"> & {
  roles: RoleType[];
  orgId: NonNullable<Doc<"users">["orgId"]>;
};

/**
 * Gets the authenticated user from context.
 * Throws if unauthenticated or user record not found.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User record not found");
  }

  if (!user.orgId) {
    throw new Error("User has no organization membership");
  }

  // Derive roles: prefer new `roles` field, fall back to legacy `role`
  const roles: RoleType[] = user.roles ?? (user.role ? [user.role] : []);

  if (roles.length === 0) {
    throw new Error("User has no organization membership");
  }

  return { ...user, roles, orgId: user.orgId } as AuthenticatedUser;
}

/**
 * Asserts the user has one of the specified roles.
 */
export function assertRole(
  user: AuthenticatedUser,
  allowedRoles: RoleType[],
): void {
  if (!hasAnyRole(user.roles, allowedRoles)) {
    throw new Error(
      `Insufficient permissions. Required: ${allowedRoles.join(" or ")}`,
    );
  }
}

/**
 * Asserts the resource belongs to the user's org.
 */
export function assertOrgAccess(
  user: AuthenticatedUser,
  resourceOrgId: Doc<"organizations">["_id"],
): void {
  if (user.orgId.toString() !== resourceOrgId.toString()) {
    throw new Error(
      "Access denied: resource belongs to a different organization",
    );
  }
}
```

- [ ] **Step 3: Run codegen + typecheck**

Run: `pnpm dlx convex codegen` (from `packages/convex`)
Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 known pre-existing errors. The backward-compat logic handles the transition.

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/lib/auth.ts
git commit -m "feat(convex): add roles array + active field to schema; update auth layer"
```


---

### Task 3: Update Backend Mutations (roles-based guards)

**Files:**
- Modify: `packages/convex/src/mutations/schedules.ts`
- Modify: `packages/convex/src/mutations/blockouts.ts`
- Modify: `packages/convex/src/mutations/bookings.ts`

- [ ] **Step 1: Update schedules.ts**

Replace `packages/convex/src/mutations/schedules.ts`:

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import { hasRole, Role } from "../lib/roles";

export const upsert = mutation({
  args: {
    therapistId: v.id("users"),
    venueId: v.id("venues"),
    workingDays: v.array(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    slotDuration: v.number(),
    availabilityHorizonDays: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    // Therapist can only manage their own schedule
    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }

    // Check target therapist is active
    const targetUser = await ctx.db.get(args.therapistId);
    if (!targetUser || targetUser.active === false) {
      throw new Error("Cannot create schedule for an inactive user");
    }

    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        workingDays: args.workingDays,
        startTime: args.startTime,
        endTime: args.endTime,
        slotDuration: args.slotDuration,
        availabilityHorizonDays: args.availabilityHorizonDays,
      });
      return existing._id;
    }

    return await ctx.db.insert("schedules", { ...args, status: "active" });
  },
});

export const remove = mutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== schedule.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }

    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Update blockouts.ts**

In `packages/convex/src/mutations/blockouts.ts`, add import at line 3:

```ts
import { hasRole, Role } from "../lib/roles";
```

Replace all 4 occurrences of:
```ts
if (user.role === "therapist" && user._id.toString() !== args.therapistId.toString()) {
```
and:
```ts
if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
```

With:
```ts
if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== args.therapistId.toString()) {
```
and:
```ts
if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== blockout.therapistId.toString()) {
```

In the `create` handler, after the role check (around line 19), add:

```ts
    // Check the acting user is active
    if (user.active === false) {
      throw new Error("Inactive users cannot create blockouts");
    }
```

- [ ] **Step 3: Update bookings.ts**

In `packages/convex/src/mutations/bookings.ts`:

Add import at line 6 (after performCancel import):
```ts
import { hasRole, Role } from "../lib/roles";
```

After the venue-not-found check (around line 27), add an active-therapist guard:
```ts
    // Reject booking if target therapist is inactive
    const therapist = await ctx.db.get(args.therapistId);
    if (!therapist || therapist.active === false) {
      throw new Error("Cannot book with an inactive therapist");
    }
```

Replace the capacity override check (lines 29-41):
```ts
    if (args.overCapacity) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required for capacity override");
      }
      const authUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
        .unique();
      if (!authUser || !hasRole(authUser.roles ?? (authUser.role ? [authUser.role] : []), Role.Owner)) {
        throw new Error("Only owners can override venue capacity");
      }
    }
```

Replace the reschedule therapist guard (line 195):
```ts
    if (user.role === "therapist" && user._id.toString() !== booking.therapistId.toString()) {
```
With:
```ts
    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== booking.therapistId.toString()) {
```

- [ ] **Step 4: Run codegen + typecheck**

Run: `pnpm dlx convex codegen` (from `packages/convex`)
Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/mutations/schedules.ts packages/convex/src/mutations/blockouts.ts packages/convex/src/mutations/bookings.ts
git commit -m "refactor(convex): use roles array in mutation guards"
```


---

### Task 4: Update Queries + Create User Mutations

**Files:**
- Modify: `packages/convex/src/queries/users.ts`
- Create: `packages/convex/src/mutations/users.ts`
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Update queries/users.ts**

Replace `packages/convex/src/queries/users.ts`:

```ts
import { v } from "convex/values";
import { query } from "../_generated/server";
import { hasRole, Role, type RoleType } from "../lib/roles";

export const getPublic = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return { _id: user._id, name: user.name };
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const schedules = allSchedules.filter((s) => s.status === "active");
    const therapistIds = [...new Set(schedules.map((s) => s.therapistId))];
    const users = await Promise.all(
      therapistIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        // Exclude inactive users
        if (user.active === false) return null;
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
  },
});

export const listTherapistsByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    // Include any user with "therapist" in their roles who is active
    const therapists = allUsers.filter((u) => {
      const roles: RoleType[] = u.roles ?? (u.role ? [u.role as RoleType] : []);
      return hasRole(roles, Role.Therapist) && u.active !== false;
    });
    return therapists.map((t) => ({ _id: t._id, name: t.name }));
  },
});

export const getSelf = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) return null;

    // Derive roles: prefer new field, fall back to legacy
    const roles: RoleType[] = user.roles ?? (user.role ? [user.role as RoleType] : []);

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      roles,
      active: user.active ?? true,
      orgId: user.orgId ?? null,
    };
  },
});
```

- [ ] **Step 2: Create mutations/users.ts**

Create `packages/convex/src/mutations/users.ts`:

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";
import { hasRole, Role, type RoleType } from "../lib/roles";

export const setActive = mutation({
  args: {
    userId: v.id("users"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    // Cannot deactivate yourself
    if (user._id.toString() === args.userId.toString()) {
      throw new Error("Cannot deactivate yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Ensure target belongs to same org
    if (targetUser.orgId) {
      assertOrgAccess(user, targetUser.orgId);
    }

    // Cannot deactivate the only owner
    if (!args.active) {
      const targetRoles: RoleType[] = targetUser.roles ?? (targetUser.role ? [targetUser.role as RoleType] : []);
      if (hasRole(targetRoles, Role.Owner)) {
        const orgUsers = await ctx.db
          .query("users")
          .withIndex("by_orgId", (q) => q.eq("orgId", user.orgId))
          .take(100);
        const activeOwners = orgUsers.filter((u) => {
          const r: RoleType[] = u.roles ?? (u.role ? [u.role as RoleType] : []);
          return hasRole(r, Role.Owner) && u.active !== false;
        });
        if (activeOwners.length <= 1) {
          throw new Error("Cannot deactivate the only active owner");
        }
      }
    }

    await ctx.db.patch(args.userId, { active: args.active });
  },
});

export const toggleTherapistRole = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    // Toggle "therapist" in the owner's roles
    const currentRoles: RoleType[] = user.roles ?? [];
    const hasTherapist = hasRole(currentRoles, Role.Therapist);

    const newRoles: RoleType[] = hasTherapist
      ? currentRoles.filter((r) => r !== Role.Therapist)
      : [...currentRoles, Role.Therapist];

    await ctx.db.patch(user._id, { roles: newRoles });
  },
});
```

- [ ] **Step 3: Add new mutations to convex-api.ts**

In `apps/admin/lib/convex-api.ts`, add inside the `mutations` object:

```ts
    users: {
      setActive: null as unknown as {
        args: { userId: string; active: boolean };
        returns: null;
      };
      toggleTherapistRole: null as unknown as {
        args: Record<string, never>;
        returns: null;
      };
    };
```

- [ ] **Step 4: Run codegen + typecheck**

Run: `pnpm dlx convex codegen` (from `packages/convex`)
Run: `pnpm --filter @openschedule/convex typecheck`
Run: `pnpm --filter admin typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/queries/users.ts packages/convex/src/mutations/users.ts apps/admin/lib/convex-api.ts
git commit -m "feat(convex): update user queries for roles array; add setActive + toggleTherapistRole mutations"
```


---

### Task 5: Update betterAuth Triggers

**Files:**
- Modify: `packages/convex/src/betterAuth/auth.ts:98-127`

- [ ] **Step 1: Update member.onCreate trigger**

In `packages/convex/src/betterAuth/auth.ts`, replace the `member.onCreate` handler (lines 99-116):

```ts
        onCreate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc.organizationId))
            .unique();
          if (!org) return;

          // Determine the role to assign
          const newRole = doc.role === "owner" ? "owner" : "therapist";

          // Merge with existing roles (e.g., an owner accepting an invite keeps "owner")
          const existingRoles: string[] = user.roles ?? (user.role ? [user.role] : []);
          const mergedRoles = existingRoles.includes(newRole)
            ? existingRoles
            : [...existingRoles, newRole];

          await ctx.db.patch(user._id, {
            orgId: org._id,
            roles: mergedRoles as ("owner" | "therapist")[],
            active: user.active ?? true,
          });
        },
```

- [ ] **Step 2: Update member.onUpdate trigger**

Replace the `member.onUpdate` handler (lines 117-127):

```ts
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          const newRole = doc.role === "owner" ? "owner" : "therapist";
          const existingRoles: string[] = user.roles ?? (user.role ? [user.role] : []);
          const mergedRoles = existingRoles.includes(newRole)
            ? existingRoles
            : [...existingRoles, newRole];

          await ctx.db.patch(user._id, {
            roles: mergedRoles as ("owner" | "therapist")[],
          });
        },
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/betterAuth/auth.ts
git commit -m "refactor(convex): update betterAuth triggers to write roles array"
```

---

### Task 6: Update Tests

**Files:**
- Modify: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Update all test fixtures from `role` to `roles`**

In `packages/convex/src/tests/bookings.test.ts`, find all occurrences of:
```ts
role: "therapist",
```
and replace with:
```ts
roles: ["therapist"],
```

Find all occurrences of:
```ts
role: "owner",
```
and replace with:
```ts
roles: ["owner"],
```

These appear in the `ctx.db.insert("users", {...})` calls throughout the test file (approximately 15+ occurrences across all test fixtures).

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @openschedule/convex exec vitest run src/tests/bookings.test.ts`
Expected: All tests pass (the auth layer's backward-compat handles both `role` and `roles`, but we update tests to use the new field so they reflect production).

- [ ] **Step 3: Run full test suite**

Run: `pnpm --filter @openschedule/convex test`
Expected: 44/44 tests pass. Exit code 1 from benign `_scheduled_functions` rejections only.

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/tests/bookings.test.ts
git commit -m "test(convex): update test fixtures to use roles array"
```


---

### Task 7: Update Admin Frontend Role Checks

**Files:**
- Modify: `apps/admin/components/today-page.tsx`
- Modify: `apps/admin/components/bookings-page.tsx`
- Modify: `apps/admin/components/schedule-page.tsx`
- Modify: `apps/admin/components/org-nav.tsx`
- Modify: `apps/admin/components/org-dashboard-page.tsx`
- Modify: `apps/admin/components/venue-settings-page.tsx`

- [ ] **Step 1: Add hasRole import to each file**

In each of the 6 files listed above, add at the top (after existing imports):

```ts
import { hasRole, Role } from "@openschedule/convex/src/lib/roles";
```

- [ ] **Step 2: Replace role checks in today-page.tsx**

In `apps/admin/components/today-page.tsx`, replace lines 36-37:
```ts
  const isTherapist = currentUser?.role === "therapist";
  const isOwner = currentUser?.role === "owner";
```
With:
```ts
  const isTherapist = hasRole(currentUser?.roles, Role.Therapist);
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 3: Replace role checks in bookings-page.tsx**

In `apps/admin/components/bookings-page.tsx`, replace lines 47-48:
```ts
  const isTherapist = currentUser?.role === "therapist";
  const isOwner = currentUser?.role === "owner";
```
With:
```ts
  const isTherapist = hasRole(currentUser?.roles, Role.Therapist);
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 4: Replace role checks in schedule-page.tsx**

In `apps/admin/components/schedule-page.tsx`, replace lines 51-52:
```ts
  const isOwner = currentUser?.role === "owner";
  const isTherapist = currentUser?.role === "therapist";
```
With:
```ts
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
  const isTherapist = hasRole(currentUser?.roles, Role.Therapist);
```

- [ ] **Step 5: Replace role check in org-nav.tsx**

In `apps/admin/components/org-nav.tsx`, replace line 15:
```ts
  const isOwner = currentUser?.role === "owner";
```
With:
```ts
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 6: Replace role check in org-dashboard-page.tsx**

In `apps/admin/components/org-dashboard-page.tsx`, replace line 65:
```ts
  const isOwner = currentUser?.role === "owner";
```
With:
```ts
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 7: Replace role check in venue-settings-page.tsx**

In `apps/admin/components/venue-settings-page.tsx`, replace line 57:
```ts
  const isOwner = currentUser?.role === "owner";
```
With:
```ts
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 8: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/components/today-page.tsx apps/admin/components/bookings-page.tsx apps/admin/components/schedule-page.tsx apps/admin/components/org-nav.tsx apps/admin/components/org-dashboard-page.tsx apps/admin/components/venue-settings-page.tsx
git commit -m "refactor(admin): use hasRole helper for all role checks"
```

---

### Task 8: Update Team Section (Active Toggle + Role Badges)

**Files:**
- Modify: `apps/admin/components/team-section.tsx`

- [ ] **Step 1: Add imports and mutation hook**

In `apps/admin/components/team-section.tsx`, add after line 4:

```ts
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { hasRole, Role } from "@openschedule/convex/src/lib/roles";
```

- [ ] **Step 2: Add mutation hook inside TeamSection component**

After the existing state declarations (around line 45), add:

```ts
  const setActive = useMutation(convexApi.mutations.users.setActive);
  const toggleTherapist = useMutation(convexApi.mutations.users.toggleTherapistRole);
  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = hasRole(currentUser?.roles, Role.Owner);
```

- [ ] **Step 3: Add toggle handler**

After `handleResendInvitation` (around line 129), add:

```ts
  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      await setActive({ userId: userId as any, active: !currentlyActive });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle active status:", err);
    }
  }

  async function handleToggleOwnTherapist() {
    try {
      await toggleTherapist({});
    } catch (err) {
      console.error("Failed to toggle therapist role:", err);
    }
  }
```

- [ ] **Step 4: Update member list rendering**

Replace the member `<Badge>` and button section (inside the `members.map` around lines 163-188):

```tsx
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {member.role === "owner" ? "Owner" : "Therapist"}
                    </Badge>
                    {member.role !== "owner" && (
```

With:

```tsx
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {member.role === "owner" ? "Owner" : "Therapist"}
                    </Badge>
                    <Badge variant={member.user.active !== false ? "outline" : "destructive"}>
                      {member.user.active !== false ? "Active" : "Inactive"}
                    </Badge>
                    {member.role !== "owner" && isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(member.userId, member.user.active !== false)}
                      >
                        {member.user.active !== false ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                    {member.role !== "owner" && (
```

Note: The `member.user.active` field comes from better-auth's member list which may not include our custom `active` field. If the member list from better-auth doesn't include `active`, the implementer should query Convex users separately or add a parallel query. The toggle button calls our Convex mutation either way.

- [ ] **Step 5: Add "Also a Therapist" toggle for owner**

After the invite form section (after line 250), add:

```tsx
        {/* Owner self-toggle */}
        {isOwner && currentUser && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Your Role</h4>
            <div className="flex items-center gap-2">
              <span className="text-sm">Also take bookings as a therapist</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleOwnTherapist}
              >
                {hasRole(currentUser.roles, Role.Therapist) ? "Remove Therapist Role" : "Add Therapist Role"}
              </Button>
            </div>
          </div>
        )}
```

- [ ] **Step 6: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/components/team-section.tsx
git commit -m "feat(admin): add active toggle and owner-as-therapist self-assignment in team section"
```


---

### Task 9: Migration Script + Schema Cleanup + Final Verification

**Files:**
- Create: `packages/convex/src/mutations/migrate.ts`
- Modify: `packages/convex/src/schema.ts` (remove legacy `role` field after migration)

- [ ] **Step 1: Create migration mutation**

Create `packages/convex/src/mutations/migrate.ts`:

```ts
import { mutation } from "../_generated/server";
import type { RoleType } from "../lib/roles";

/**
 * One-shot migration: converts legacy `role` field to `roles` array.
 * Idempotent — safe to re-run. Run manually via Convex dashboard or CLI.
 */
export const migrateRolesToArray = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(1000);
    let migrated = 0;

    for (const user of users) {
      // Skip users that already have `roles` set
      if (user.roles && user.roles.length > 0) continue;

      const legacyRole = user.role;
      if (!legacyRole) continue;

      const roles: RoleType[] = [legacyRole as RoleType];
      await ctx.db.patch(user._id, { roles });
      migrated++;
    }

    return { migrated, total: users.length };
  },
});
```

- [ ] **Step 2: Run codegen + typecheck**

Run: `pnpm dlx convex codegen` (from `packages/convex`)
Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 known pre-existing errors.

- [ ] **Step 3: Commit the migration**

```bash
git add packages/convex/src/mutations/migrate.ts
git commit -m "feat(convex): add one-shot role migration mutation"
```

- [ ] **Step 4: Remove legacy `role` field from schema (after migration runs)**

In `packages/convex/src/schema.ts`, update the users table to remove the legacy field:

```ts
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    roles: v.optional(v.array(v.union(v.literal("owner"), v.literal("therapist")))),
    active: v.optional(v.boolean()),
    orgId: v.optional(v.id("organizations")),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"])
    .index("by_orgId", ["orgId"]),
```

Note: This removes both the `role` field and the `by_orgId_and_role` index. Only do this AFTER the migration has run on the deployment.

- [ ] **Step 5: Remove backward-compat fallbacks**

In `packages/convex/src/lib/auth.ts`, simplify the roles derivation:

Replace:
```ts
  const roles: RoleType[] = user.roles ?? (user.role ? [user.role] : []);
```
With:
```ts
  const roles: RoleType[] = user.roles ?? [];
```

In `packages/convex/src/queries/users.ts`, in both `listTherapistsByOrg` and `getSelf`, remove the legacy fallback:

Replace all occurrences of:
```ts
    const roles: RoleType[] = u.roles ?? (u.role ? [u.role as RoleType] : []);
```
With:
```ts
    const roles: RoleType[] = u.roles ?? [];
```

And in `getSelf`:
```ts
    const roles: RoleType[] = user.roles ?? (user.role ? [user.role as RoleType] : []);
```
With:
```ts
    const roles: RoleType[] = user.roles ?? [];
```

In `packages/convex/src/mutations/users.ts`, in `setActive`:
Replace:
```ts
      const targetRoles: RoleType[] = targetUser.roles ?? (targetUser.role ? [targetUser.role as RoleType] : []);
```
With:
```ts
      const targetRoles: RoleType[] = targetUser.roles ?? [];
```

In `packages/convex/src/mutations/bookings.ts`, simplify the capacity override check:
Replace:
```ts
      if (!authUser || !hasRole(authUser.roles ?? (authUser.role ? [authUser.role] : []), Role.Owner)) {
```
With:
```ts
      if (!authUser || !hasRole(authUser.roles, Role.Owner)) {
```

- [ ] **Step 6: Run codegen + full typecheck + tests**

Run: `pnpm dlx convex codegen` (from `packages/convex`)
Run: `pnpm --filter @openschedule/convex typecheck`
Run: `pnpm --filter admin typecheck`
Run: `pnpm --filter @openschedule/convex test`
Expected: Only 2 pre-existing typecheck errors. All 44 tests pass.

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: No new errors in touched files.

- [ ] **Step 8: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/lib/auth.ts packages/convex/src/queries/users.ts packages/convex/src/mutations/users.ts packages/convex/src/mutations/bookings.ts
git commit -m "refactor(convex): remove legacy role field and backward-compat fallbacks"
```

---

## Execution Notes

- **Migration ordering:** Tasks 1-8 can ship with the legacy `role` field still present (backward-compat in auth layer handles both). Task 9 Step 4+ should only happen AFTER the migration mutation has run against the live deployment.
- **Dev data:** The test Convex deployment has users with the old `role` field. Run `migrateRolesToArray` via the Convex dashboard after deploying Tasks 1-8.
- **Import path for admin:** `@openschedule/convex/src/lib/roles` works because `packages/convex` is a workspace dependency of `apps/admin` and the package.json exports allow it. If the import fails, fall back to a relative path or re-export from the package root.

