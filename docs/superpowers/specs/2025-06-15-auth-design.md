# Auth System Design — better-auth + Convex

## Overview

Authentication and authorization for openschedule's admin interface. better-auth runs inside Convex as a local component, managing user accounts, sessions, organizations, memberships, and invitations. App-level tables (`users`, `organizations`) are kept as typed projections synced via triggers.

## Goals

- Owners can sign up, create an org, and invite therapists
- Therapists accept invitations and access their org-scoped view
- All existing Convex mutations are protected with auth guards
- Custom roles (`owner`, `therapist`) with declarative permissions
- Login via email/password, Google OAuth, or magic link
- Minimal admin app shell to exercise the auth flow end-to-end
- BDD-style integration tests against a live Convex preview environment

## Architecture

### Component Layout

better-auth runs as a **Convex local component** inside `packages/convex`:

```
src/
├── betterAuth/
│   ├── convex.config.ts      # Component definition
│   ├── auth.ts               # better-auth instance, options, triggers
│   ├── schema.ts             # Generated schema (npx auth generate)
│   └── adapter.ts            # CRUD exports for the component
├── convex.config.ts          # App-level config, registers betterAuth component
├── auth.config.ts            # Convex auth config (getAuthConfigProvider)
├── http.ts                   # Mount auth HTTP routes
```

### Tables Owned by better-auth Component

These live in the component's isolated namespace — not in the app schema:

| Table          | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `user`         | Accounts (email, name, emailVerified, image, createdAt, updatedAt)          |
| `session`      | Active sessions (userId, token, expiresAt, ipAddress, userAgent)            |
| `account`      | OAuth/credential links (userId, providerId, accountId, password hash)       |
| `verification` | Email verification tokens, magic link tokens                                |
| `organization` | Orgs (name, slug, logo, metadata, createdAt)                                |
| `member`       | User ↔ Org join (userId, organizationId, role, createdAt)                   |
| `invitation`   | Pending invites (email, organizationId, role, status, inviterId, expiresAt) |

### App-Level Tables (Projections)

These are synced from the component via triggers and referenced by domain tables via typed `v.id()`:

**`users` table (revised):**

| Field    | Type         | Notes                                     |
| -------- | ------------ | ----------------------------------------- |
| `authId` | `v.string()` | better-auth component user ID (immutable) |
| `email`  | `v.string()` | Synced from component                     |
| `name`   | `v.string()` | Synced from component                     |

Indexes: `by_authId` (unique lookup), `by_email`.

Removed fields: `role` (lives in `member` table), `orgId` (lives in `member` table).

**`organizations` table (revised):**

| Field    | Type         | Notes                                    |
| -------- | ------------ | ---------------------------------------- |
| `authId` | `v.string()` | better-auth component org ID (immutable) |
| `name`   | `v.string()` | Synced from component                    |
| `slug`   | `v.string()` | Synced from component                    |

Indexes: `by_authId` (unique lookup), `by_slug` (public lookup).

### Triggers

Transactional sync from component to app tables:

```
user.onCreate    → insert into app `users` { authId, email, name }
user.onUpdate    → patch app `users` { email, name }
user.onDelete    → delete app `users` record (cascading: orphan schedules/blockouts/bookings remain for audit)
org.onCreate     → insert into app `organizations` { authId, name, slug }
org.onUpdate     → patch app `organizations` { name, slug }
org.onDelete     → archive app `organizations` record, archive all venues, cancel all future bookings
member.onCreate  → patch app `users` with { orgId (looked up from app orgs by member.organizationId), role }
member.onUpdate  → patch app `users` with { role }
member.onDelete  → clear app `users` { orgId, role }, cancel future bookings for that therapist, soft-delete their schedules/blockouts
```

### How Domain Tables Reference Users/Orgs

Existing domain tables (`venues`, `schedules`, `blockouts`, `bookings`, `customers`) continue to use:

- `therapistId: v.id("users")` → points to app `users._id`
- `orgId: v.id("organizations")` → points to app `organizations._id`
- `venueId: v.id("venues")` → unchanged

The app tables act as a typed bridge between better-auth's string IDs and the domain model's typed references.

## Roles & Permissions

Custom roles registered via better-auth's access control system:

### Permission Statements

```ts
const statements = {
  booking: ["create", "read", "cancel", "override-capacity"],
  venue: ["create", "update", "delete"],
  schedule: ["manage-own", "manage-all"],
  blockout: ["manage-own", "manage-all"],
  member: ["invite", "remove"],
  organization: ["update"],
} as const
```

### Role Definitions

| Role        | Permissions                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`     | booking: all, venue: all (incl. delete), schedule: manage-all, blockout: manage-all, member: all (incl. remove), organization: update |
| `therapist` | booking: create/read/cancel, schedule: manage-own, blockout: manage-own                                                               |

### Deletion Semantics

Nothing is ever hard-deleted. All deletion operations are soft-deletes using a `status` field on the relevant table. This preserves audit history and enables re-activation.

#### Soft-Delete Field Convention

| Table | Field | Values | Default |
|-------|-------|--------|---------|
| `venues` | `status` | `"active" \| "archived"` | `"active"` |
| `schedules` | `status` | `"active" \| "inactive"` | `"active"` |
| `blockouts` | `status` | `"active" \| "inactive"` | `"active"` |
| `users` | (no status field) | N/A — user record always persists; `orgId`/`role` are cleared on removal | N/A |

#### Venue Archival (Owner Only)

**Trigger:** Owner calls `venues.archive(venueId)` mutation.

**Steps:**
1. Set `venue.status = "archived"`
2. Query all bookings for this venue with `date >= today` and `status in ("pending", "confirmed")`
3. Patch each to `status: "cancelled"`
4. Schedules referencing this venue are NOT touched (they remain `"active"` — the venue being archived is sufficient to hide availability)

**Query filtering:**
- Public queries (`listByOrg`, `listByOrgPublic`, `getBySlug`) filter `status === "active"`
- Admin queries include a parameter to optionally show archived venues
- Availability queries skip archived venues (no slots returned)

**Re-activation:** Owner calls `venues.unarchive(venueId)` → sets `status = "active"`. Schedules are still there, availability immediately resumes. No cancelled bookings are restored (customers must re-book).

#### Therapist Removal (Owner Only)

**Trigger:** Owner calls better-auth's member removal API → `member.onDelete` trigger fires.

**Steps (in `member.onDelete` trigger):**
1. Look up app `users` record by matching `authId` to the removed member's `userId`
2. Clear `orgId` and `role` on the user record (set to `undefined`/remove fields)
3. Query all schedules where `therapistId === user._id` → patch each to `status: "inactive"`
4. Query all blockouts where `therapistId === user._id` and `status === "active"` → patch to `status: "inactive"`
5. Query all bookings where `therapistId === user._id`, `date >= today`, `status in ("pending", "confirmed")` → patch to `status: "cancelled"`

**The user record stays in the `users` table.** Domain references (`therapistId` on bookings, schedules, blockouts) remain valid for historical queries. The user simply has no `orgId` or `role`, so auth guards will reject any attempt to access org resources.

**Query filtering:**
- `users.listByVenue` already filters by `orgId` and `role === "therapist"` — removed users have no `orgId`, so they're automatically excluded
- Schedule/blockout queries filter `status === "active"` for operational use; admin can view inactive ones

#### Re-Invitation of a Removed Therapist

**Trigger:** Owner invites the same email again → therapist accepts → new `member` record created → `member.onCreate` trigger fires.

**Steps (in `member.onCreate` trigger):**
1. Look up existing app `users` record by `authId` (it still exists from before)
2. Patch `orgId` and `role` back onto the user record

**What happens to old data:**
- Previous schedules remain `status: "inactive"` — they are NOT automatically restored. The therapist (or owner) must create new schedules or manually reactivate old ones via an admin mutation.
- Previous blockouts remain `status: "inactive"` — same logic. Past-date blockouts are irrelevant anyway.
- Previous cancelled bookings remain cancelled — no restoration.

This is intentional: re-inviting someone doesn't imply they resume the same working hours. Their availability starts from scratch unless explicitly restored.

#### Re-Activation of Inactive Schedules/Blockouts

Admin mutations (built during admin UI spec):
- `schedules.activate(scheduleId)` → sets `status: "active"` (owner or therapist-own)
- `schedules.deactivate(scheduleId)` → sets `status: "inactive"` (owner or therapist-own)
- `blockouts.activate(blockoutId)` / `blockouts.deactivate(blockoutId)` → same pattern

These are out of scope for this auth spec but documented here for completeness.

### How Auth Guards Work in Convex Functions

Pattern for all protected mutations/queries:

```ts
// 1. Get identity (session validation handled by Convex auth framework)
const identity = await ctx.auth.getUserIdentity()
if (!identity) throw new Error("Unauthenticated")

// 2. Look up app user by authId (identity.subject)
const user = await ctx.db
  .query("users")
  .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
  .unique()
if (!user) throw new Error("User not found")

// 3. For role checks, query membership via component API
// authComponent.getAuthUser(ctx) returns user + active org + role
```

### Scope Rules

- **Owner** can operate on any resource within their org
- **Therapist** can only operate on their own schedules/blockouts, and can create/read/cancel bookings (no override-capacity)
- All queries/mutations scope to the user's active organization (prevents cross-org access)

## Login Methods

| Method         | Provider                 | Notes                                           |
| -------------- | ------------------------ | ----------------------------------------------- |
| Email/password | Built-in                 | Standard signup/login                           |
| Google OAuth   | better-auth social       | Useful since we integrate Google Calendar later |
| Magic link     | better-auth email plugin | Passwordless, sends link to email               |

## Onboarding Flow (Minimal for This Spec)

1. User navigates to `admin.openschedule.com`
2. Sees login/signup page
3. Signs up via any method (email/password, Google, magic link)
4. Post-signup: no org exists → redirected to org creation form
5. Fills in org name (slug auto-derived via slugify)
6. better-auth creates org, assigns user as `owner` role in `member` table
7. Trigger syncs → app `organizations` table gets new record
8. Redirect to `/:orgSlug` → protected dashboard showing auth state

## Invitation Flow

1. Owner navigates to team/members area
2. Enters therapist email → calls better-auth invitation API
3. Therapist receives email with accept link
4. Therapist clicks link → signs up (if new) or logs in (if existing)
5. Invitation accepted → `member` record created with `therapist` role
6. Trigger syncs user to app `users` table
7. Therapist lands on `/:orgSlug` with therapist-scoped view

## Admin App (`apps/admin`)

### Structure

Standalone Next.js 16 app in `apps/admin`:

- Shares `packages/ui` and `packages/convex`
- Own `package.json`, own Convex client setup
- Deployed at `admin.openschedule.com`

### Routes (Minimal Shell)

```
app/
├── layout.tsx                          # Root layout with ConvexBetterAuthProvider
├── api/auth/[...all]/route.ts          # Auth route handler (proxy to Convex)
├── (auth)/
│   ├── login/page.tsx                  # Login form (email/pw, Google, magic link)
│   └── signup/page.tsx                 # Signup form
├── (protected)/
│   ├── layout.tsx                      # Auth guard (redirect if unauthenticated)
│   ├── onboarding/page.tsx             # Org creation form (name → slug)
│   └── [orgSlug]/
│       └── page.tsx                    # Dashboard: "Authenticated as {name}, role: {role}, org: {orgName}"
```

### Client-Side Auth

```ts
// lib/auth-client.ts
import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [convexClient(), organizationClient()],
})
```

### Server-Side Auth

```ts
// lib/auth-server.ts
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs"

export const { handler, isAuthenticated, getToken } = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
})
```

## Environment Variables

### Convex (set via `npx convex env set`)

- `BETTER_AUTH_SECRET` — signing secret for sessions/tokens
- `SITE_URL` — public URL of the admin app (e.g., `https://admin.openschedule.com`)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret

### Admin App (`.env.local`)

- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` — Convex site URL (HTTP endpoints)

## Schema Migration

### Changes to Existing `users` Table

Remove:

- `role` field (now in better-auth `member` table)
- `orgId` field (now in better-auth `member` table)
- `by_orgId` index
- `by_orgId_and_role` index

Add:

- `authId: v.string()` field
- `by_authId` index

### Changes to Existing `venues` Table

Add:

- `status: v.union(v.literal("active"), v.literal("archived"))` field (default `"active"`)

All existing venue queries must filter by `status === "active"` for public-facing queries. Admin queries can include archived venues.

### Changes to Existing `schedules` Table

Add:

- `status: v.union(v.literal("active"), v.literal("inactive"))` field (default `"active"`)

All existing schedule queries must filter by `status === "active"` for operational use (availability computation, public listing).

### Changes to Existing `blockouts` Table

Add:

- `status: v.union(v.literal("active"), v.literal("inactive"))` field (default `"active"`)

Availability computation only considers blockouts with `status === "active"`.

### Changes to Existing `organizations` Table

Add:

- `authId: v.string()` field
- `by_authId` index

Keep:

- `name`, `slug`, `by_slug` index (unchanged)

### Impact on Existing Queries/Mutations

All files that reference `users.orgId` or `users.role` need updating:

- `queries/users.ts` — `listByVenue` currently uses `by_orgId_and_role` index. Needs rework to use membership lookup.
- `mutations/organizations.ts` — no user.orgId dependency, should be fine
- `mutations/bookings.ts` — auth guard addition, role check for over-capacity

The `users.ts` queries (`getPublic`, `listByVenue`) served the public booking flow (listing therapists). These need a different approach since we no longer have `orgId` on users. Options:

- Add a `schedules` index lookup (therapists with a schedule at a venue = active therapists there)
- Or keep a denormalized `orgId` on app `users` purely for the public query (synced via trigger using membership data)

Decision: Keep `orgId` on the app `users` table as a **denormalized field synced from membership**. The trigger for `member.onCreate` sets `orgId` on the user record. This preserves the existing `by_orgId` and `by_orgId_and_role` indexes and avoids cascading changes to the public booking flow.

Revised app `users` table:

| Field    | Type                     | Notes                                                 |
| -------- | ------------------------ | ----------------------------------------------------- |
| `authId` | `v.string()`             | better-auth component user ID                         |
| `email`  | `v.string()`             | Synced from component                                 |
| `name`   | `v.string()`             | Synced from component                                 |
| `orgId`  | `v.id("organizations")`  | Denormalized from membership (set on member.onCreate) |
| `role`   | `"owner" \| "therapist"` | Denormalized from membership role                     |

Indexes: `by_authId`, `by_email`, `by_orgId`, `by_orgId_and_role`.

This means the app `users` table is identical to what it is today, plus `authId`. The trigger logic becomes:

- `user.onCreate` → insert user with `authId`, `email`, `name` (no org/role yet)
- `user.onUpdate` → patch `email`, `name`
- `user.onDelete` → delete app `users` record (orphan references in schedules/bookings remain for audit)
- `member.onCreate` → patch user with `orgId` (looked up from app `organizations` by authId) and `role`
- `member.onUpdate` → patch `role`
- `member.onDelete` → clear user's `orgId` and `role`, cancel future bookings, soft-delete schedules/blockouts

## BDD-Style Integration Tests

Vitest test suite that hits a live Convex preview deployment via HTTP. Tests exercise the auth system end-to-end without a browser.

### Test Cases

1. **Signup creates user** — POST to signup endpoint → verify app `users` table has new record with matching `authId`
2. **Login returns session** — POST credentials → receive valid session token
3. **Create org** — Authenticated call to create org → verify app `organizations` synced, `member` created with `owner` role, user's `orgId`/`role` updated
4. **Invite therapist** — Owner invites email → invitation record created with `pending` status
5. **Accept invitation** — Therapist signs up with invited email → member record created, user gets `therapist` role and `orgId`
6. **Auth guard rejects unauthenticated** — Call protected mutation without token → error
7. **Owner can create venue** — Authenticated as owner → venue creation succeeds
8. **Therapist cannot create venue** — Authenticated as therapist → venue creation rejected
9. **Owner can override capacity** — Booking with `overCapacity: true` succeeds for owner
10. **Therapist cannot override capacity** — Booking with `overCapacity: true` rejected for therapist
11. **Cross-org isolation** — User from org A cannot access org B's resources
12. **Owner can archive venue** — Venue status set to `archived`, future bookings cancelled, venue excluded from public queries
13. **Therapist cannot archive venue** — Authenticated as therapist → venue archival rejected
14. **Owner can remove therapist** — Member removed, user's orgId/role cleared, future bookings cancelled
15. **Therapist cannot remove members** — Authenticated as therapist → member removal rejected
16. **Magic link flow** — Request magic link → verify token created (email delivery not tested)
17. **Google OAuth stub** — Verify Google provider is configured (actual OAuth flow tested via Playwright later)

### Test Setup

- Requires a Convex preview deployment (CI or local `npx convex dev`)
- Tests create/destroy their own test data (org + users) per suite
- Auth HTTP endpoints called directly (no browser)
- Convex functions called via the Convex client with auth tokens from the HTTP auth flow

## Out of Scope

- Full admin UI (separate spec)
- Email delivery (tested via token presence, not actual send)
- Playwright E2E tests (deferred to admin UI spec)
- Customer auth (customers have no accounts in MVP)
- Password reset flow (better-auth handles this; we just enable it)
- Rate limiting configuration (better-auth defaults are fine for MVP)
