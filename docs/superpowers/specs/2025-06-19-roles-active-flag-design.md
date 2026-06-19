# Roles Array + Active Flag Design

## Summary

Replace the single `role: "owner" | "therapist"` field on users with `roles: ["owner", "therapist"]` (array) so an owner can also be a therapist (have schedules, take bookings). Add an `active: boolean` flag so therapists can be deactivated without deletion.

## Schema

### Before

```ts
users: defineTable({
  authId: v.string(),
  email: v.string(),
  name: v.string(),
  role: v.optional(v.union(v.literal("owner"), v.literal("therapist"))),
  orgId: v.optional(v.id("organizations")),
})
```

### After

```ts
users: defineTable({
  authId: v.string(),
  email: v.string(),
  name: v.string(),
  roles: v.optional(v.array(v.union(v.literal("owner"), v.literal("therapist")))),
  active: v.optional(v.boolean()), // absent or true = active; false = deactivated
  orgId: v.optional(v.id("organizations")),
})
```

- Remove the `by_orgId_and_role` index (can't index into arrays in Convex).
- Keep the `by_orgId` index (already exists).
- `active` defaults to `true` when absent — no migration needed for existing users.

## Migration

Write a one-shot Convex migration mutation (run manually or via script):

1. For each user with `role` set: write `roles: [role]`, then `delete role` (unset the field via `ctx.db.patch`).
2. For users with no `role`: set `roles: []` (or leave absent; absent = no roles = pre-onboarding state).

The migration is idempotent — safe to re-run. After migration, the old `role` field no longer exists on any document.

## Query Changes

### `users.listTherapistsByOrg({ orgId })`

Fetch all users by `by_orgId` index, filter:
- `user.roles?.includes("therapist")`
- `user.active !== false`

Returns `{ _id, name }[]` (unchanged shape).

### `users.listByVenue({ venueId })`

Currently schedule-driven (joins through active schedules). Add a post-filter:
- After resolving therapist IDs from schedules, fetch each user and exclude where `user.active === false`.

This prevents a deactivated therapist from appearing in the customer booking flow even if their schedule record still exists.

### `users.getSelf`

Return `roles` instead of `role`:

```ts
return {
  _id: user._id,
  name: user.name,
  email: user.email,
  roles: user.roles ?? [],
  orgId: user.orgId ?? null,
  active: user.active ?? true,
};
```

### New: `users.setActive({ userId, active })`

Mutation (owner-only). Sets `active` on the target user. Does NOT cancel existing bookings — the owner handles wind-down manually.

Validation: cannot deactivate yourself. Cannot deactivate the only owner in an org (prevent lockout).

### Mutation gating for inactive users

Add `active !== false` check to mutations that create resources:
- `schedules.upsert` — reject if therapist `active === false`
- `bookings.create` — reject if assigned therapist `active === false`
- `blockouts.create` — reject if user `active === false`

These prevent an inactive therapist (or someone acting on their behalf) from creating new work, even though they can still log in to view existing data.

## Auth Layer Changes

### `lib/auth.ts`

`assertRole` currently checks `user.role`. Change to use the domain `hasRole` helper:

```ts
import { hasRole, type RoleType } from "./roles";

export function assertRole(
  user: AuthenticatedUser,
  allowedRoles: RoleType[],
) {
  const permitted = allowedRoles.some((r) => hasRole(user.roles, r));
  if (!permitted) throw new Error("Insufficient permissions");
}
```

`AuthenticatedUser` type: `role` field → `roles: RoleType[]`.

### `betterAuth/auth.ts` triggers

`member.onCreate`: normalize better-auth's `"member"` role → `roles: ["therapist"]`. If the user already has `roles` (e.g., they were an owner who got re-invited), append `"therapist"` without removing `"owner"`.

`member.onUpdate`: same normalization logic.

## Domain Layer: Role Enum + Helper

Create `packages/convex/src/lib/roles.ts`:

```ts
export const Role = {
  Owner: "owner",
  Therapist: "therapist",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export function hasRole(roles: RoleType[] | undefined, role: RoleType): boolean {
  return roles?.includes(role) ?? false;
}
```

All role checks — backend and frontend — use `hasRole(user.roles, Role.Owner)` instead of raw string comparisons. The admin app imports `Role` and `hasRole` from the convex package (already a workspace dependency).

## Admin UI Changes

### Role checks (all components)

Replace throughout:
- `currentUser?.role === "owner"` → `hasRole(currentUser?.roles, Role.Owner)`
- `currentUser?.role === "therapist"` → `hasRole(currentUser?.roles, Role.Therapist)`

Files affected: `today-page.tsx`, `bookings-page.tsx`, `schedule-page.tsx`, `org-nav.tsx`, `org-dashboard-page.tsx`, `venue-settings-page.tsx`, `fab.tsx`, `booking-detail-modal.tsx`, `new-booking-sheet.tsx`.

### Team Section

- Show `Active` / `Inactive` badge next to each member.
- Owner gets a toggle button to activate/deactivate therapists.
- An owner-therapist appears as "Owner + Therapist" badge.

### Schedule Page

- Therapist picker: already uses `listTherapistsByOrg` which will now include active owners with the therapist role and exclude inactive users.
- An owner with `["owner", "therapist"]` in their roles can create a schedule for themselves.

### Owner self-assignment

In Org Settings or Team section, an owner can toggle themselves as "also a therapist" which adds `"therapist"` to their `roles` array. This is a simple `ctx.db.patch` call.

## Customer-Facing Impact

- `listByVenue` (schedule-driven) gains the `active !== false` post-filter. An inactive therapist stops appearing even if their schedule is active.
- No changes to the booking form, cancel flow, or confirmation pages.
- The "Any available" random selection already works off `listByVenue`, so it automatically excludes inactive therapists.

## Deactivation Behavior

- Deactivating a therapist: they stop appearing in new bookings. Existing future bookings remain intact. The owner can manually reschedule/cancel them via the Bookings tab.
- The deactivated therapist can still log in to the admin (their session remains valid) but sees only their own existing data in read-only mode. They cannot create new bookings or schedules.
- Re-activating a therapist: they reappear in the system immediately (their schedule, if still active, surfaces them to customers).

## Out of Scope

- Auto-cancelling future bookings on deactivation (decision: leave intact).
- Preventing login for deactivated users (they can still view their own data).
- UI for managing individual role assignments beyond owner self-toggle.
- New roles beyond `"owner"` and `"therapist"`.
