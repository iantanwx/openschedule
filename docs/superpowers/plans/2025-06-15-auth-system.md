# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authentication and authorization to openschedule using better-auth running inside Convex as a local component, with a minimal admin app shell to exercise the flow.

**Architecture:** better-auth runs as a Convex local component (`src/betterAuth/`) managing users, sessions, organizations, and memberships. App-level `users` and `organizations` tables are synced via triggers. Existing mutations get auth guards. A new `apps/admin` Next.js app provides login/signup/onboarding UI.

**Tech Stack:** better-auth, @convex-dev/better-auth, Convex components, Next.js 16, React 19

---

## Typing Rule

Always use `Doc<>` / `Id<>` from `src/_generated/dataModel` as source of truth. DTOs via `Pick<>`. No non-null assertions (`!`). Prefer `const` narrowing.

## File Structure

### New Files (packages/convex)

```
src/
├── betterAuth/
│   ├── convex.config.ts        # Component definition
│   ├── auth.ts                 # better-auth instance + triggers
│   ├── schema.ts               # Generated (npx auth generate)
│   └── adapter.ts              # CRUD exports
├── convex.config.ts            # App-level, registers component
├── auth.config.ts              # Convex auth config
├── http.ts                     # Mount auth HTTP routes
├── lib/
│   └── auth.ts                 # Auth guard helper (getAuthUser)
├── mutations/
│   └── venues.ts               # Add archive/unarchive mutations
```

### Modified Files (packages/convex)

```
src/schema.ts                   # Add authId, status fields
src/mutations/bookings.ts       # Auth guards on confirm/cancel
src/mutations/venues.ts         # Auth guards, add status to create
src/mutations/organizations.ts  # Auth guards
src/mutations/schedules.ts      # Auth guards
src/mutations/blockouts.ts      # Auth guards
src/queries/availability.ts     # Filter by schedule/blockout status
src/queries/venues.ts           # Filter by venue status
src/queries/users.ts            # Filter by active schedule status
src/tests/bookings.test.ts      # Update for new schema fields
```

### New Files (apps/admin)

```
apps/admin/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── components.json
├── .env.local.example
├── lib/
│   ├── auth-client.ts
│   └── auth-server.ts
├── components/
│   └── convex-provider.tsx
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/auth/[...all]/route.ts
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── (protected)/
│       ├── layout.tsx
│       ├── onboarding/page.tsx
│       └── [orgSlug]/
│           └── page.tsx
```

---

### Task 1: Dependencies

**Files:**
- Modify: `packages/convex/package.json`
- Modify: `pnpm-workspace.yaml` (no change needed — `apps/*` already included)

- [ ] **Step 1: Install better-auth and Convex adapter in packages/convex**

```bash
cd packages/convex
pnpm add better-auth @convex-dev/better-auth
```

This adds:
- `better-auth` — auth library
- `@convex-dev/better-auth` — Convex component adapter

- [ ] **Step 2: Verify installation**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Same pre-existing errors only (no new errors from deps)

- [ ] **Step 3: Commit**

```bash
git add packages/convex/package.json pnpm-lock.yaml
git commit -m "feat(auth): add better-auth and convex adapter dependencies"
```

---

### Task 2: Schema Migration

**Files:**
- Modify: `packages/convex/src/schema.ts`

- [ ] **Step 1: Update the schema**

Add `authId` to `users` and `organizations`, make `orgId`/`role` optional on `users`, add `status` to `venues`/`schedules`/`blockouts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    authId: v.string(),
    name: v.string(),
    slug: v.string(),
  })
    .index("by_authId", ["authId"])
    .index("by_slug", ["slug"]),

  venues: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"]),

  schedules: defineTable({
    therapistId: v.id("users"),
    venueId: v.id("venues"),
    workingDays: v.array(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    slotDuration: v.number(),
    availabilityHorizonDays: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_therapistId", ["therapistId"])
    .index("by_venueId", ["venueId"])
    .index("by_therapistId_and_venueId", ["therapistId", "venueId"]),

  blockouts: defineTable({
    therapistId: v.id("users"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_therapistId", ["therapistId"])
    .index("by_therapistId_and_date", ["therapistId", "date"]),

  customers: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_email", ["orgId", "email"]),

  bookings: defineTable({
    venueId: v.id("venues"),
    therapistId: v.id("users"),
    customerId: v.id("customers"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
    ),
    createdBy: v.union(
      v.literal("customer"),
      v.literal("therapist"),
      v.literal("owner"),
    ),
    overCapacity: v.boolean(),
  })
    .index("by_venueId", ["venueId"])
    .index("by_therapistId", ["therapistId"])
    .index("by_customerId", ["customerId"])
    .index("by_venueId_and_date", ["venueId", "date"])
    .index("by_therapistId_and_date", ["therapistId", "date"]),

  settings: defineTable({
    scope: v.union(
      v.literal("org"),
      v.literal("user"),
      v.literal("venue"),
    ),
    scopeId: v.string(),
    version: v.number(),
    data: v.any(),
  }).index("by_scope_and_scopeId", ["scope", "scopeId"]),

  integrations: defineTable({
    scope: v.literal("user"),
    scopeId: v.id("users"),
    provider: v.literal("google-calendar"),
    version: v.number(),
    config: v.any(),
    enabled: v.boolean(),
  })
    .index("by_scopeId", ["scopeId"])
    .index("by_scopeId_and_provider", ["scopeId", "provider"]),

  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("owner"), v.literal("therapist"))),
    orgId: v.optional(v.id("organizations")),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"])
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_role", ["orgId", "role"]),
});
```

- [ ] **Step 2: Update existing tests for new required fields**

Modify `packages/convex/src/tests/bookings.test.ts`: Add `status: "active"` to schedule inserts, `status: "active"` to blockout inserts, `status: "active"` to venue inserts, and `authId: "test-auth-id"` to user inserts, `authId: "test-org-auth"` to org inserts. Make user inserts use optional `role` and `orgId`.

In the test setup where users are inserted, add:
```ts
// For user inserts, add authId:
const therapistId = await t.run(async (ctx) => {
  return await ctx.db.insert("users", {
    authId: "test-therapist-auth",
    email: "therapist@test.com",
    name: "Test Therapist",
    role: "therapist",
    orgId: orgId,
  });
});
```

For org inserts, add:
```ts
const orgId = await t.run(async (ctx) => {
  return await ctx.db.insert("organizations", {
    authId: "test-org-auth",
    name: "Test Org",
    slug: "test-org",
  });
});
```

For venue inserts, add `status: "active"`:
```ts
const venueId = await t.run(async (ctx) => {
  return await ctx.db.insert("venues", {
    orgId: orgId,
    name: "Test Venue",
    slug: "test-venue",
    timezone: "Asia/Singapore",
    capacity: 3,
    dayStart: "09:00",
    dayEnd: "18:00",
    status: "active",
  });
});
```

For schedule inserts, add `status: "active"`:
```ts
await t.run(async (ctx) => {
  await ctx.db.insert("schedules", {
    therapistId,
    venueId,
    workingDays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60,
    availabilityHorizonDays: 14,
    status: "active",
  });
});
```

- [ ] **Step 3: Run tests to verify schema change doesn't break logic**

Run: `pnpm --filter @openschedule/convex test`
Expected: 13/13 tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/tests/
git commit -m "feat(auth): add authId, status fields to schema"
```

---

### Task 3: Update Existing Queries for Status Filtering

**Files:**
- Modify: `packages/convex/src/queries/venues.ts`
- Modify: `packages/convex/src/queries/availability.ts`
- Modify: `packages/convex/src/queries/users.ts`
- Modify: `packages/convex/src/mutations/venues.ts`

- [ ] **Step 1: Update venues.ts — filter active venues in public queries**

In `listByOrg`, `listByOrgPublic`, and `getBySlug`, add a filter for `status === "active"` after fetching. Since Convex doesn't support `.filter()`, we either need a composite index or post-fetch filtering. Since the result sets are small (take 100), post-fetch filtering is acceptable:

```ts
// In listByOrg handler, after fetching:
const activeVenues = venues.filter((v) => v.status === "active");
return activeVenues.map(({ _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status }) => ({
  _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status,
}));

// In listByOrgPublic handler:
const activeVenues = venues.filter((v) => v.status === "active");
return activeVenues.map(({ _id, name, slug, timezone }) => ({ _id, name, slug, timezone }));

// In getBySlug handler, after .unique():
if (!venue || venue.status !== "active") return null;
```

The `get` query does NOT filter by status (admin may need to see archived venues).

- [ ] **Step 2: Update venues.ts mutations — add status to create**

In `mutations/venues.ts`, add `status: "active"` to the insert call:

```ts
// In create handler:
return await ctx.db.insert("venues", { ...args, status: "active" });
```

Remove `status` from the args validator (it's always set to "active" on creation).

- [ ] **Step 3: Update availability.ts — filter active schedules and blockouts**

In `getSlots`:
```ts
const schedule = await ctx.db
  .query("schedules")
  .withIndex("by_therapistId_and_venueId", (q) =>
    q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
  )
  .unique();

if (!schedule || schedule.status !== "active") {
  return {};
}
```

In `getSlotsForAllTherapists`:
```ts
const allSchedules = await ctx.db
  .query("schedules")
  .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
  .take(100);

const schedules = allSchedules.filter((s) => s.status === "active");
```

For blockouts, filter after fetch:
```ts
const allBlockouts = await ctx.db
  .query("blockouts")
  .withIndex("by_therapistId_and_date", (q) => ...)
  .take(200);
const blockouts = allBlockouts.filter((b) => b.status === "active");
```

- [ ] **Step 4: Update users.ts — filter by active schedules**

In `listByVenue`, only include therapists with active schedules:

```ts
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
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
  },
});
```

- [ ] **Step 5: Update mutations/schedules.ts — add status to upsert**

In `upsert`, when inserting a new schedule, add `status: "active"`:

```ts
return await ctx.db.insert("schedules", { ...args, status: "active" });
```

When patching an existing schedule, don't touch `status` (it's managed separately).

- [ ] **Step 6: Update mutations/blockouts.ts — add status to create**

In `create`, add `status: "active"`:

```ts
return await ctx.db.insert("blockouts", { ...args, status: "active" });
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: 13/13 pass

- [ ] **Step 8: Commit**

```bash
git add packages/convex/src/queries/ packages/convex/src/mutations/
git commit -m "feat(auth): filter by status in queries, add status on insert"
```

---

### Task 4: better-auth Component Setup

**Files:**
- Create: `packages/convex/src/betterAuth/convex.config.ts`
- Create: `packages/convex/src/betterAuth/auth.ts`
- Create: `packages/convex/src/betterAuth/adapter.ts`
- Create: `packages/convex/src/convex.config.ts`
- Create: `packages/convex/src/auth.config.ts`
- Create: `packages/convex/src/http.ts`

- [ ] **Step 1: Create the component definition**

Create `packages/convex/src/betterAuth/convex.config.ts`:

```ts
import { defineComponent } from "convex/server";

const component = defineComponent("betterAuth");
export default component;
```

- [ ] **Step 2: Create the auth instance with triggers**

Create `packages/convex/src/betterAuth/auth.ts`:

```ts
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          await ctx.db.insert("users", {
            authId: doc._id,
            email: doc.email,
            name: doc.name ?? "Unknown",
          });
        },
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (user) {
            await ctx.db.patch(user._id, {
              email: doc.email,
              name: doc.name ?? user.name,
            });
          }
        },
        onDelete: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (user) {
            await ctx.db.delete(user._id);
          }
        },
      },
      organization: {
        onCreate: async (ctx, doc) => {
          await ctx.db.insert("organizations", {
            authId: doc._id,
            name: doc.name,
            slug: doc.slug,
          });
        },
        onUpdate: async (ctx, doc) => {
          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (org) {
            await ctx.db.patch(org._id, {
              name: doc.name,
              slug: doc.slug,
            });
          }
        },
        onDelete: async (ctx, doc) => {
          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (!org) return;
          // Archive all venues and cancel future bookings
          const venues = await ctx.db
            .query("venues")
            .withIndex("by_orgId", (q) => q.eq("orgId", org._id))
            .take(100);
          for (const venue of venues) {
            if (venue.status === "active") {
              await ctx.db.patch(venue._id, { status: "archived" });
            }
          }
          // Note: booking cancellation for all venues would be handled by
          // a scheduled action if the venue count is large. For MVP, inline.
          await ctx.db.delete(org._id);
        },
      },
      member: {
        onCreate: async (ctx, doc) => {
          // Look up app user by authId matching the member's userId
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          // Look up app org by authId matching the member's organizationId
          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc.organizationId))
            .unique();
          if (!org) return;

          await ctx.db.patch(user._id, {
            orgId: org._id,
            role: doc.role as "owner" | "therapist",
          });
        },
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          await ctx.db.patch(user._id, {
            role: doc.role as "owner" | "therapist",
          });
        },
        onDelete: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          // Clear org membership
          await ctx.db.patch(user._id, {
            orgId: undefined,
            role: undefined,
          });

          // Soft-delete schedules
          const schedules = await ctx.db
            .query("schedules")
            .withIndex("by_therapistId", (q) => q.eq("therapistId", user._id))
            .take(100);
          for (const schedule of schedules) {
            if (schedule.status === "active") {
              await ctx.db.patch(schedule._id, { status: "inactive" });
            }
          }

          // Soft-delete blockouts
          const blockouts = await ctx.db
            .query("blockouts")
            .withIndex("by_therapistId", (q) => q.eq("therapistId", user._id))
            .take(200);
          for (const blockout of blockouts) {
            if (blockout.status === "active") {
              await ctx.db.patch(blockout._id, { status: "inactive" });
            }
          }

          // Cancel future bookings
          // Note: date comparison uses string comparison (YYYY-MM-DD format)
          const today = new Date().toISOString().split("T")[0] ?? "";
          const bookings = await ctx.db
            .query("bookings")
            .withIndex("by_therapistId_and_date", (q) =>
              q.eq("therapistId", user._id).gte("date", today),
            )
            .take(500);
          for (const booking of bookings) {
            if (booking.status !== "cancelled") {
              await ctx.db.patch(booking._id, { status: "cancelled" });
            }
          }
        },
      },
    },
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: "OpenSchedule",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true },
    emailVerification: { sendVerificationEmail: false },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    plugins: [
      convex({ authConfig }),
      organization({
        allowUserToCreateOrganization: true,
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // In production, send email with the magic link URL.
          // For MVP, the token is stored in the verification table
          // and we log it (email delivery is out of scope).
          console.log(`Magic link for ${email}: ${url}`);
        },
      }),
    ],
  } satisfies BetterAuthOptions;
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
```

- [ ] **Step 3: Create the adapter exports**

Create `packages/convex/src/betterAuth/adapter.ts`:

```ts
import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "./auth";
import schema from "./schema";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
```

- [ ] **Step 4: Generate the better-auth schema**

Run:
```bash
cd packages/convex
pnpm dlx auth generate --config ./src/betterAuth/auth.ts --output ./src/betterAuth/schema.ts
```

If this command fails (it often does without a running instance), create the schema manually based on better-auth's documented schema for user + session + account + verification + organization + member + invitation tables. The generated file defines the Convex table schemas for the component.

Fallback — create `packages/convex/src/betterAuth/schema.ts` manually:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  session: defineTable({
    userId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  account: defineTable({
    userId: v.string(),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    idToken: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_providerId_and_accountId", ["providerId", "accountId"]),

  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_identifier", ["identifier"]),

  organization: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  member: defineTable({
    userId: v.string(),
    organizationId: v.string(),
    role: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_userId_and_organizationId", ["userId", "organizationId"]),

  invitation: defineTable({
    email: v.string(),
    organizationId: v.string(),
    role: v.string(),
    status: v.string(),
    inviterId: v.string(),
    expiresAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_organizationId", ["organizationId"]),
});
```

- [ ] **Step 5: Create app-level convex.config.ts**

Create `packages/convex/src/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);

export default app;
```

- [ ] **Step 6: Create auth.config.ts**

Create `packages/convex/src/auth.config.ts`:

```ts
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
```

- [ ] **Step 7: Create http.ts**

Create `packages/convex/src/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);

export default http;
```

- [ ] **Step 8: Verify typecheck**

Run: `pnpm --filter @openschedule/convex typecheck`

Note: There may be type errors related to the component types not being generated yet. The generated types (`_generated/api.ts`) won't include `components.betterAuth` until `convex dev` runs against a deployment. For now, ensure no other type errors are introduced. If `components` is undefined, add a type assertion comment to unblock:

```ts
// In auth.ts, if components.betterAuth doesn't type:
const betterAuthComponent = (components as any).betterAuth;
```

However, follow the AGENTS.md rule — no `!` assertions. Use a const guard:

```ts
const betterAuthRef = components.betterAuth;
if (!betterAuthRef) throw new Error("betterAuth component not registered");
```

- [ ] **Step 9: Commit**

```bash
git add packages/convex/src/betterAuth/ packages/convex/src/convex.config.ts packages/convex/src/auth.config.ts packages/convex/src/http.ts
git commit -m "feat(auth): set up better-auth component with triggers"
```

---

### Task 5: Auth Guard Helper

**Files:**
- Create: `packages/convex/src/lib/auth.ts`

- [ ] **Step 1: Create the auth guard helper**

Create `packages/convex/src/lib/auth.ts`:

```ts
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export type AuthenticatedUser = Doc<"users"> & {
  role: "owner" | "therapist";
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

  if (!user.orgId || !user.role) {
    throw new Error("User has no organization membership");
  }

  return user as AuthenticatedUser;
}

/**
 * Asserts the user has one of the specified roles.
 */
export function assertRole(
  user: AuthenticatedUser,
  allowedRoles: Array<"owner" | "therapist">,
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Insufficient permissions. Required: ${allowedRoles.join(" or ")}`);
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
    throw new Error("Access denied: resource belongs to a different organization");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/convex/src/lib/auth.ts
git commit -m "feat(auth): add auth guard helper utilities"
```

---

### Task 6: Protect Existing Mutations with Auth Guards

**Files:**
- Modify: `packages/convex/src/mutations/venues.ts`
- Modify: `packages/convex/src/mutations/organizations.ts`
- Modify: `packages/convex/src/mutations/schedules.ts`
- Modify: `packages/convex/src/mutations/blockouts.ts`
- Modify: `packages/convex/src/mutations/bookings.ts`

- [ ] **Step 1: Protect venues.ts mutations**

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    const existing = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (existing) {
      throw new Error(`Venue with slug "${args.slug}" already exists in this org`);
    }
    return await ctx.db.insert("venues", { ...args, status: "active" });
  },
});

export const update = mutation({
  args: {
    id: v.id("venues"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    timezone: v.optional(v.string()),
    capacity: v.optional(v.number()),
    dayStart: v.optional(v.string()),
    dayEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const { id, ...fields } = args;
    const venue = await ctx.db.get(id);
    if (!venue) {
      throw new Error("Venue not found");
    }
    assertOrgAccess(user, venue.orgId);

    if (fields.slug && fields.slug !== venue.slug) {
      const newSlug = fields.slug;
      const existing = await ctx.db
        .query("venues")
        .withIndex("by_orgId_and_slug", (q) =>
          q.eq("orgId", venue.orgId).eq("slug", newSlug),
        )
        .unique();
      if (existing) {
        throw new Error(`Venue with slug "${newSlug}" already exists in this org`);
      }
    }
    const patch: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    if (venue.status === "archived") {
      throw new Error("Venue is already archived");
    }

    await ctx.db.patch(args.id, { status: "archived" });

    // Cancel future bookings
    const today = new Date().toISOString().split("T")[0] ?? "";
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.id).gte("date", today),
      )
      .take(500);

    for (const booking of bookings) {
      if (booking.status !== "cancelled") {
        await ctx.db.patch(booking._id, { status: "cancelled" });
      }
    }
  },
});

export const unarchive = mutation({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    if (venue.status === "active") {
      throw new Error("Venue is already active");
    }

    await ctx.db.patch(args.id, { status: "active" });
  },
});
```

- [ ] **Step 2: Protect organizations.ts mutations**

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // Org creation is handled by better-auth org plugin.
    // This mutation is for internal/seed use only.
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(`Organization with slug "${args.slug}" already exists`);
    }
    return await ctx.db.insert("organizations", {
      authId: "seed-" + Date.now().toString(),
      name: args.name,
      slug: args.slug,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const { id, ...fields } = args;
    const org = await ctx.db.get(id);
    if (!org) {
      throw new Error("Organization not found");
    }
    assertOrgAccess(user, org._id);

    if (fields.slug && fields.slug !== org.slug) {
      const newSlug = fields.slug;
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .unique();
      if (existing) {
        throw new Error(`Organization with slug "${newSlug}" already exists`);
      }
    }
    const patch: Record<string, string> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.slug !== undefined) patch.slug = fields.slug;
    await ctx.db.patch(id, patch);
  },
});
```

- [ ] **Step 3: Protect schedules.ts mutations**

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";

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

    // Owner can manage any schedule; therapist can only manage their own
    if (user.role === "therapist" && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }
    assertRole(user, ["owner", "therapist"]);

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

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (user.role === "therapist" && user._id.toString() !== schedule.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }
    assertRole(user, ["owner", "therapist"]);

    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 4: Protect blockouts.ts mutations**

```ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";

export const create = mutation({
  args: {
    therapistId: v.id("users"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    if (user.role === "therapist" && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }
    assertRole(user, ["owner", "therapist"]);

    return await ctx.db.insert("blockouts", { ...args, status: "active" });
  },
});

export const update = mutation({
  args: {
    id: v.id("blockouts"),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const { id, ...fields } = args;
    const blockout = await ctx.db.get(id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }
    assertRole(user, ["owner", "therapist"]);

    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }
    assertRole(user, ["owner", "therapist"]);

    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 5: Protect bookings.ts mutations (except create — used by public flow)**

The `bookings.create` mutation is called by the public booking flow (customers), so it stays unprotected. But `confirm` and `cancel` need guards:

```ts
// Add to existing bookings.ts imports:
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

// Replace confirm handler:
export const confirm = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify org access via venue
    const venue = await ctx.db.get(booking.venueId);
    if (venue) {
      assertOrgAccess(user, venue.orgId);
    }

    if (booking.status !== "pending") {
      throw new Error(
        `Cannot confirm a booking with status "${booking.status}"`,
      );
    }
    await ctx.db.patch(args.id, { status: "confirmed" });
  },
});

// Replace cancel handler:
export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    // Cancel can be called by authenticated admin OR by the public booking flow
    // For now, allow unauthenticated cancel (customer can cancel via confirmation page)
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled");
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});
```

Also, add overCapacity protection to `create`:

```ts
// In bookings.create handler, before the overCapacity check:
if (args.overCapacity) {
  // Only owners can override capacity
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can override venue capacity");
    }
  } else {
    throw new Error("Authentication required for capacity override");
  }
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @openschedule/convex test`

Note: Tests will fail because they don't have auth context. We need to update the test setup to either:
1. Skip auth in test mode (not ideal)
2. Mock `ctx.auth.getUserIdentity()`

With `convex-test`, we can use `t.run()` with identity. Update tests to use authenticated context where needed. For the existing booking tests that test the public `create` flow, they should still pass since `create` doesn't require auth. The `confirm` mutation now requires auth, so those test calls need identity.

For the existing tests, the simplest fix is:
- The booking creation tests don't call `confirm`, so they pass unchanged.
- If any test calls `confirm`, wrap it with identity.

Check if existing tests call `confirm` — from the test file, it tests `creates a pending booking`, `prevents double-booking`, `prevents booking when venue at capacity`, `allows over-capacity booking`, `confirms a pending booking`, `cancels a booking`.

The "confirms a pending booking" and "allows over-capacity booking" tests will now fail. Update them to run with auth context using `convex-test`'s `withIdentity` pattern:

```ts
// For tests that need auth, use t.run with identity:
await t.mutation(
  api.mutations.bookings.confirm,
  { id: bookingId },
  { identity: { subject: "test-therapist-auth", issuer: "test" } },
);
```

Check `convex-test` docs for the exact identity API. It's typically:

```ts
const asOwner = t.withIdentity({ subject: "test-owner-auth", issuer: "https://test.com", tokenIdentifier: "https://test.com|test-owner-auth" });
await asOwner.mutation(api.mutations.bookings.confirm, { id: bookingId });
```

- [ ] **Step 7: Commit**

```bash
git add packages/convex/src/mutations/ packages/convex/src/tests/
git commit -m "feat(auth): add auth guards to all admin mutations"
```

---

### Task 7: Admin App Scaffolding

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/postcss.config.mjs`
- Create: `apps/admin/.env.local.example`

- [ ] **Step 1: Create apps/admin/package.json**

```json
{
  "name": "admin",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "oxlint",
    "format": "oxfmt --write .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@convex-dev/better-auth": "^0.1.0",
    "@openschedule/convex": "workspace:*",
    "@openschedule/ui": "workspace:*",
    "better-auth": "^1.0.0",
    "convex": "^1.21.0",
    "lucide-react": "^1.18.0",
    "next": "16.2.6",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@openschedule/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

- [ ] **Step 2: Create apps/admin/tsconfig.json**

```json
{
  "extends": "@openschedule/typescript-config/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@openschedule/ui/*": ["../../packages/ui/src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create apps/admin/next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openschedule/ui"],
};

export default nextConfig;
```

- [ ] **Step 4: Create apps/admin/postcss.config.mjs**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create apps/admin/.env.local.example**

```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/
git commit -m "feat(auth): scaffold admin app with dependencies"
```

---

### Task 8: Admin App Auth Client Setup

**Files:**
- Create: `apps/admin/lib/auth-client.ts`
- Create: `apps/admin/lib/auth-server.ts`
- Create: `apps/admin/components/convex-provider.tsx`
- Create: `apps/admin/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create auth-client.ts**

```ts
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [convexClient(), organizationClient()],
});

export const { signIn, signUp, signOut, useSession, useActiveOrganization } =
  authClient;
```

- [ ] **Step 2: Create auth-server.ts**

```ts
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
if (!convexSiteUrl) throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is not set");

export const { handler, isAuthenticated, getToken } =
  convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });
```

- [ ] **Step 3: Create convex-provider.tsx**

```tsx
"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: React.ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

- [ ] **Step 4: Create the auth route handler**

Create `apps/admin/app/api/auth/[...all]/route.ts`:

```ts
import { handler } from "@/lib/auth-server";

export const { GET, POST } = handler;
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/ apps/admin/components/ apps/admin/app/api/
git commit -m "feat(auth): add admin app auth client and server setup"
```

---

### Task 9: Admin App Layout and Styles

**Files:**
- Create: `apps/admin/app/layout.tsx`
- Create: `apps/admin/app/globals.css`

- [ ] **Step 1: Create globals.css**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

- [ ] **Step 2: Create root layout**

```tsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/convex-provider";
import { cn } from "@openschedule/ui/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "OpenSchedule Admin",
  description: "Admin dashboard for OpenSchedule",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/layout.tsx apps/admin/app/globals.css
git commit -m "feat(auth): add admin app root layout with styles"
```

---

### Task 10: Admin App Auth Pages (Login/Signup)

**Files:**
- Create: `apps/admin/app/(auth)/login/page.tsx`
- Create: `apps/admin/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create login page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Login failed");
    } else {
      router.push("/");
    }
  }

  async function handleGoogleLogin() {
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to your OpenSchedule admin account
          </p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create signup page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUp.email({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Signup failed");
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground text-sm">
            Get started with OpenSchedule
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/\(auth\)/
git commit -m "feat(auth): add login and signup pages"
```

---

### Task 11: Admin App Protected Routes

**Files:**
- Create: `apps/admin/app/(protected)/layout.tsx`
- Create: `apps/admin/app/(protected)/onboarding/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/page.tsx`

- [ ] **Step 1: Create protected layout with auth guard**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";

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

  return <>{children}</>;
}
```

- [ ] **Step 2: Create onboarding page (org creation)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.organization.create({
      name,
      slug,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Failed to create organization");
    } else {
      // Set as active organization
      await authClient.organization.setActive({
        organizationId: result.data.id,
      });
      router.push(`/${slug}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create your organization</h1>
          <p className="text-muted-foreground text-sm">
            Set up your scheduling workspace
          </p>
        </div>

        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="My Clinic"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">URL slug</Label>
            <Input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="my-clinic"
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-muted-foreground">
              admin.openschedule.com/{slug || "your-org"}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create org dashboard page**

```tsx
"use client";

import { use } from "react";
import { useSession, useActiveOrganization, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@openschedule/ui/components/button";

export default function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6 text-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Authenticated as:</span>{" "}
            {session?.user?.name ?? "Unknown"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {session?.user?.email ?? "Unknown"}
          </p>
          <p>
            <span className="text-muted-foreground">Organization:</span>{" "}
            {activeOrg?.name ?? orgSlug}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span>{" "}
            {activeOrg?.members?.[0]?.role ?? "unknown"}
          </p>
        </div>

        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(protected\)/
git commit -m "feat(auth): add protected layout, onboarding, and dashboard pages"
```

---

### Task 12: Admin App Root Page (Redirect Logic)

**Files:**
- Create: `apps/admin/app/page.tsx`

- [ ] **Step 1: Create the root page with redirect logic**

The root page checks session state and redirects:
- Not logged in → `/login`
- Logged in, no org → `/onboarding`
- Logged in, has org → `/:orgSlug`

```tsx
"use client";

import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization();

  useEffect(() => {
    if (sessionPending || orgPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!activeOrg) {
      router.replace("/onboarding");
      return;
    }

    router.replace(`/${activeOrg.slug}`);
  }, [session, activeOrg, sessionPending, orgPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/app/page.tsx
git commit -m "feat(auth): add root page with session-based redirect"
```

---

### Task 13: Update Existing Booking Tests for Auth

**Files:**
- Modify: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Read the current test file and update**

The existing tests insert users, orgs, venues, schedules, and bookings directly. With the new schema requiring `authId`, `status` fields, and some mutations requiring auth, update the tests:

1. Add `authId` to all user inserts
2. Add `authId` to org inserts
3. Add `status: "active"` to venue, schedule, blockout inserts
4. The `confirm` test needs identity context
5. The over-capacity test needs identity context (since `overCapacity: true` now requires owner auth)

```ts
// Use convex-test identity pattern:
const asOwner = t.withIdentity({
  subject: "test-owner-auth",
  issuer: "https://test.com",
  tokenIdentifier: "https://test.com|test-owner-auth",
});

// For over-capacity test:
await asOwner.mutation(api.mutations.bookings.create, {
  venueId,
  therapistId,
  customerId,
  date: "2025-01-06",
  startTime: "09:00",
  endTime: "10:00",
  createdBy: "owner",
  overCapacity: true,
});

// For confirm test:
await asOwner.mutation(api.mutations.bookings.confirm, { id: bookingId });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/tests/bookings.test.ts
git commit -m "test(auth): update booking tests for auth-guarded mutations"
```

---

### Task 14: Verify Build and Type Check

**Files:** None (verification only)

- [ ] **Step 1: Type check convex package**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Pass (or only pre-existing component type errors that resolve after `convex dev`)

- [ ] **Step 2: Type check admin app**

Run: `pnpm --filter admin typecheck`
Expected: Pass

- [ ] **Step 3: Type check web app**

Run: `pnpm --filter web typecheck`
Expected: Pass (web app doesn't use auth — only the public booking flow)

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All pass

- [ ] **Step 5: Build admin app**

Create `.env.local` for build:
```bash
echo "NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud" > apps/admin/.env.local
echo "NEXT_PUBLIC_CONVEX_SITE_URL=https://placeholder.convex.site" >> apps/admin/.env.local
```

Run: `pnpm --filter admin build`
Expected: Build succeeds

- [ ] **Step 6: Build web app**

Run: `pnpm --filter web build`
Expected: Build succeeds (unchanged from before)

---

### Task 15: Package Exports Update

**Files:**
- Modify: `packages/convex/package.json`

- [ ] **Step 1: Add auth exports to package.json**

Add exports for the auth helper so the admin app can import guard utilities if needed:

```json
{
  "exports": {
    "./api": {
      "types": "./src/_generated/api.d.ts",
      "default": "./src/_generated/api.js"
    },
    "./dataModel": "./src/_generated/dataModel.d.ts",
    "./schema": "./src/schema.ts",
    "./types/*": "./src/types/*",
    "./lib/auth": "./src/lib/auth.ts"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/convex/package.json
git commit -m "feat(auth): export auth helper from convex package"
```

---

### Task 16: Auth Guard Unit Tests (convex-test)

**Files:**
- Create: `packages/convex/src/tests/auth-guards.test.ts`

These tests use `convex-test` with mocked identity to verify auth guards on mutations. They don't test the full better-auth flow (that requires a live deployment) but verify that the guard logic works correctly.

- [ ] **Step 1: Write auth guard tests**

Create `packages/convex/src/tests/auth-guards.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.ts");

describe("auth guards", () => {
  let orgId: Id<"organizations">;
  let venueId: Id<"venues">;
  let ownerId: Id<"users">;
  let therapistId: Id<"users">;
  let customerId: Id<"customers">;

  async function setupTestData(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const org = await ctx.db.insert("organizations", {
        authId: "auth-org-1",
        name: "Test Org",
        slug: "test-org",
      });
      const venue = await ctx.db.insert("venues", {
        orgId: org,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "Asia/Singapore",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "18:00",
        status: "active",
      });
      const owner = await ctx.db.insert("users", {
        authId: "auth-owner-1",
        email: "owner@test.com",
        name: "Test Owner",
        role: "owner",
        orgId: org,
      });
      const therapist = await ctx.db.insert("users", {
        authId: "auth-therapist-1",
        email: "therapist@test.com",
        name: "Test Therapist",
        role: "therapist",
        orgId: org,
      });
      const customer = await ctx.db.insert("customers", {
        orgId: org,
        email: "customer@test.com",
        name: "Test Customer",
      });
      return { orgId: org, venueId: venue, ownerId: owner, therapistId: therapist, customerId: customer };
    });
  }

  test("unauthenticated user cannot create venue", async () => {
    const t = convexTest(schema, modules);
    const { orgId: org } = await setupTestData(t);

    await expect(
      t.mutation(api.mutations.venues.create, {
        orgId: org,
        name: "New Venue",
        slug: "new-venue",
        timezone: "UTC",
        capacity: 2,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  test("owner can create venue", async () => {
    const t = convexTest(schema, modules);
    const { orgId: org } = await setupTestData(t);

    const asOwner = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    const venueId = await asOwner.mutation(api.mutations.venues.create, {
      orgId: org,
      name: "New Venue",
      slug: "new-venue",
      timezone: "UTC",
      capacity: 2,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    expect(venueId).toBeDefined();
  });

  test("therapist cannot create venue", async () => {
    const t = convexTest(schema, modules);
    const { orgId: org } = await setupTestData(t);

    const asTherapist = t.withIdentity({
      subject: "auth-therapist-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-therapist-1",
    });

    await expect(
      asTherapist.mutation(api.mutations.venues.create, {
        orgId: org,
        name: "New Venue",
        slug: "new-venue",
        timezone: "UTC",
        capacity: 2,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Insufficient permissions");
  });

  test("owner can archive venue", async () => {
    const t = convexTest(schema, modules);
    const { venueId: venue } = await setupTestData(t);

    const asOwner = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    await asOwner.mutation(api.mutations.venues.archive, { id: venue });

    const updatedVenue = await t.run(async (ctx) => {
      return await ctx.db.get(venue);
    });
    expect(updatedVenue?.status).toBe("archived");
  });

  test("therapist cannot archive venue", async () => {
    const t = convexTest(schema, modules);
    const { venueId: venue } = await setupTestData(t);

    const asTherapist = t.withIdentity({
      subject: "auth-therapist-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-therapist-1",
    });

    await expect(
      asTherapist.mutation(api.mutations.venues.archive, { id: venue }),
    ).rejects.toThrow("Insufficient permissions");
  });

  test("owner can override capacity", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    // Create a schedule for the therapist
    await t.run(async (ctx) => {
      await ctx.db.insert("schedules", {
        therapistId: data.therapistId,
        venueId: data.venueId,
        workingDays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        slotDuration: 60,
        availabilityHorizonDays: 14,
        status: "active",
      });
    });

    // Fill venue to capacity
    for (let i = 0; i < 3; i++) {
      const extraTherapist = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          authId: `auth-extra-${i}`,
          email: `extra${i}@test.com`,
          name: `Extra ${i}`,
          role: "therapist",
          orgId: data.orgId,
        });
      });
      await t.run(async (ctx) => {
        await ctx.db.insert("bookings", {
          venueId: data.venueId,
          therapistId: extraTherapist,
          customerId: data.customerId,
          date: "2025-06-20",
          startTime: "09:00",
          endTime: "10:00",
          status: "confirmed",
          createdBy: "customer",
          overCapacity: false,
        });
      });
    }

    const asOwner = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    // Owner can override capacity
    const bookingId = await asOwner.mutation(api.mutations.bookings.create, {
      venueId: data.venueId,
      therapistId: data.therapistId,
      customerId: data.customerId,
      date: "2025-06-20",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "owner",
      overCapacity: true,
    });

    expect(bookingId).toBeDefined();
  });

  test("therapist cannot override capacity", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("schedules", {
        therapistId: data.therapistId,
        venueId: data.venueId,
        workingDays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        slotDuration: 60,
        availabilityHorizonDays: 14,
        status: "active",
      });
    });

    const asTherapist = t.withIdentity({
      subject: "auth-therapist-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-therapist-1",
    });

    await expect(
      asTherapist.mutation(api.mutations.bookings.create, {
        venueId: data.venueId,
        therapistId: data.therapistId,
        customerId: data.customerId,
        date: "2025-06-20",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "therapist",
        overCapacity: true,
      }),
    ).rejects.toThrow("Only owners can override venue capacity");
  });

  test("cross-org isolation — user from org A cannot access org B venues", async () => {
    const t = convexTest(schema, modules);
    await setupTestData(t);

    // Create a second org
    const orgB = await t.run(async (ctx) => {
      const org = await ctx.db.insert("organizations", {
        authId: "auth-org-2",
        name: "Org B",
        slug: "org-b",
      });
      await ctx.db.insert("users", {
        authId: "auth-owner-b",
        email: "ownerb@test.com",
        name: "Owner B",
        role: "owner",
        orgId: org,
      });
      return org;
    });

    // Owner A tries to create venue in org B
    const asOwnerA = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    await expect(
      asOwnerA.mutation(api.mutations.venues.create, {
        orgId: orgB,
        name: "Sneaky Venue",
        slug: "sneaky",
        timezone: "UTC",
        capacity: 1,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Access denied");
  });

  test("therapist can manage own schedule", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    const asTherapist = t.withIdentity({
      subject: "auth-therapist-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-therapist-1",
    });

    const scheduleId = await asTherapist.mutation(api.mutations.schedules.upsert, {
      therapistId: data.therapistId,
      venueId: data.venueId,
      workingDays: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "17:00",
      slotDuration: 60,
      availabilityHorizonDays: 14,
    });

    expect(scheduleId).toBeDefined();
  });

  test("therapist cannot manage another therapist's schedule", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    // Create another therapist
    const otherTherapist = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "auth-therapist-2",
        email: "other@test.com",
        name: "Other Therapist",
        role: "therapist",
        orgId: data.orgId,
      });
    });

    const asTherapist1 = t.withIdentity({
      subject: "auth-therapist-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-therapist-1",
    });

    await expect(
      asTherapist1.mutation(api.mutations.schedules.upsert, {
        therapistId: otherTherapist,
        venueId: data.venueId,
        workingDays: [1, 2, 3],
        startTime: "10:00",
        endTime: "16:00",
        slotDuration: 30,
        availabilityHorizonDays: 7,
      }),
    ).rejects.toThrow("Therapists can only manage their own schedule");
  });

  test("venue archival cancels future bookings", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    // Create a future booking
    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        venueId: data.venueId,
        therapistId: data.therapistId,
        customerId: data.customerId,
        date: "2099-01-01",
        startTime: "09:00",
        endTime: "10:00",
        status: "confirmed",
        createdBy: "customer",
        overCapacity: false,
      });
    });

    const asOwner = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    await asOwner.mutation(api.mutations.venues.archive, { id: data.venueId });

    const booking = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId);
    });
    expect(booking?.status).toBe("cancelled");
  });

  test("owner can confirm a booking", async () => {
    const t = convexTest(schema, modules);
    const data = await setupTestData(t);

    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        venueId: data.venueId,
        therapistId: data.therapistId,
        customerId: data.customerId,
        date: "2025-06-20",
        startTime: "09:00",
        endTime: "10:00",
        status: "pending",
        createdBy: "customer",
        overCapacity: false,
      });
    });

    const asOwner = t.withIdentity({
      subject: "auth-owner-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|auth-owner-1",
    });

    await asOwner.mutation(api.mutations.bookings.confirm, { id: bookingId });

    const booking = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId);
    });
    expect(booking?.status).toBe("confirmed");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All tests pass (existing 13 + new ~11 auth guard tests)

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/tests/auth-guards.test.ts
git commit -m "test(auth): add auth guard unit tests"
```

---

## Notes for Implementers

### Environment Setup

Before running the admin app or integration tests, you need:

1. A Convex deployment: `cd packages/convex && npx convex dev`
2. Set env vars on the deployment:
   ```bash
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   npx convex env set SITE_URL "http://localhost:3001"
   ```
3. Copy the deployment URL to `apps/admin/.env.local`

### Component Type Generation

The `components.betterAuth` type won't be available until you run `convex dev` against a deployment with the component registered. Until then, there may be type errors in `src/betterAuth/auth.ts`. This is expected and resolves after the first deployment.

### Test Auth Identity

`convex-test` supports identity mocking via `t.withIdentity()`. The `subject` field must match the `authId` stored in the app `users` table for the auth guard to find the user.

### BDD Integration Tests (Spec Test Cases 1-5, 14-17)

The spec defines 17 test cases. Task 16 covers test cases 6-13 (auth guards, permissions, cross-org isolation) using `convex-test` with mocked identity. The remaining cases require a live Convex deployment with better-auth fully running:

- Cases 1-5 (signup, login, org creation, invitation, accept) — require HTTP calls to better-auth endpoints
- Cases 14-15 (member removal permissions) — require better-auth org plugin API
- Cases 16-17 (magic link, Google OAuth) — require token verification and provider config

These are best implemented as a follow-up once the component is deployed and the HTTP endpoints are verified manually. They would live in `packages/convex/src/tests/auth-integration.test.ts` and use `fetch()` against the Convex site URL.

### What's NOT Included in This Plan

- Email delivery (magic link creates tokens but sending is not tested)
- Google OAuth flow (requires real credentials + browser)
- Playwright E2E tests (deferred to admin UI spec)
- Custom access control declarations (permissions are enforced via code guards, not declarative AC — simpler for MVP)
- Schedule/blockout activate/deactivate mutations (documented in spec, built during admin UI)
- Full 17-case BDD suite against live deployment (guard logic is covered by convex-test; HTTP flow tests require deployed instance)
