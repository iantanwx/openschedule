# Business Directory Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded landing page to the customer web app with business search and a browse carousel of active venues.

**Architecture:** Schema additions (description + coverImageId on orgs/venues), two new public Convex queries for directory listing/search, admin UI for managing the new fields, and a Next.js landing page with hero search + venue card grid.

**Tech Stack:** Next.js 16, React 19, Convex, Tailwind v4, shadcn/ui

---

## File Map

### New files
- `packages/convex/src/queries/directory.ts` — public directory queries (listPublicDirectory, searchDirectory)
- `packages/convex/src/tests/directory.test.ts` — tests for directory queries
- `apps/web/components/landing-hero.tsx` — hero section with heading + search toggle
- `apps/web/components/search-input.tsx` — autocomplete search with debounced query
- `apps/web/components/paste-link-input.tsx` — URL paste input for direct booking links
- `apps/web/components/business-carousel.tsx` — grid of venue cards
- `apps/web/components/venue-directory-card.tsx` — individual venue card

### Modified files
- `packages/convex/src/schema.ts` — add description to orgs, description + coverImageId to venues
- `packages/convex/src/types/venues.queries.ts` — add new fields to Venue and VenuePublic types
- `packages/convex/src/queries/venues.ts` — include new fields in all 5 projections
- `packages/convex/src/mutations/organizations.ts` — accept description in update
- `packages/convex/src/mutations/venues.ts` — accept description + coverImageId in create/update
- `apps/admin/lib/convex-api.ts` — add new fields to type casts
- `apps/admin/components/org-settings-form.tsx` — add org description textarea
- `apps/admin/components/venue-settings-page.tsx` — add description textarea + cover image upload
- `apps/web/app/page.tsx` — replace placeholder with landing page

---

## Task 1: Schema additions

**Files:**
- Modify: `packages/convex/src/schema.ts:5-11` (organizations table)
- Modify: `packages/convex/src/schema.ts:13-27` (venues table)
- Modify: `packages/convex/src/types/venues.queries.ts`
- Modify: `packages/convex/src/queries/venues.ts`

- [ ] **Step 1: Add `description` to organizations table**

In `packages/convex/src/schema.ts`, replace the organizations table definition:

```ts
  organizations: defineTable({
    authId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_authId", ["authId"])
    .index("by_slug", ["slug"]),
```

- [ ] **Step 2: Add `description` and `coverImageId` to venues table**

In `packages/convex/src/schema.ts`, replace the venues table definition:

```ts
  venues: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    placeId: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"]),
```

- [ ] **Step 3: Update `Venue` type to include new fields**

Replace `packages/convex/src/types/venues.queries.ts` entirely:

```ts
import { Doc } from "../_generated/dataModel";

/** Full venue for admin */
export type Venue = Pick<Doc<"venues">, "_id" | "_creationTime" | "orgId" | "name" | "slug" | "timezone" | "capacity" | "dayStart" | "dayEnd" | "status" | "address" | "coordinates" | "placeId" | "description" | "coverImageId">;

/** Public venue info for customer app (no capacity exposed) */
export type VenuePublic = Pick<Doc<"venues">, "_id" | "name" | "slug" | "timezone" | "address" | "coordinates" | "placeId" | "description" | "coverImageId">;
```

- [ ] **Step 4: Update all 5 query projections in `queries/venues.ts`**

Replace `packages/convex/src/queries/venues.ts` entirely:

```ts
import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Venue, VenuePublic } from "../types/venues.queries";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<Venue[]> => {
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    const activeVenues = venues.filter((v) => v.status === "active");
    return activeVenues.map(({ _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status, address, coordinates, placeId, description, coverImageId }) => ({
      _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status, address, coordinates, placeId, description, coverImageId,
    }));
  },
});

export const listByOrgPublic = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<VenuePublic[]> => {
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    const activeVenues = venues.filter((v) => v.status === "active");
    return activeVenues.map(({ _id, name, slug, timezone, address, coordinates, placeId, description, coverImageId }) => ({ _id, name, slug, timezone, address, coordinates, placeId, description, coverImageId }));
  },
});

export const getBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args): Promise<VenuePublic | null> => {
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (!venue || venue.status !== "active") return null;
    return { _id: venue._id, name: venue.name, slug: venue.slug, timezone: venue.timezone, address: venue.address, coordinates: venue.coordinates, placeId: venue.placeId, description: venue.description, coverImageId: venue.coverImageId };
  },
});

export const getBySlugFull = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args): Promise<Venue | null> => {
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (!venue || venue.status !== "active") return null;
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status, address: venue.address, coordinates: venue.coordinates, placeId: venue.placeId,
      description: venue.description, coverImageId: venue.coverImageId,
    };
  },
});

export const get = query({
  args: { id: v.id("venues") },
  handler: async (ctx, args): Promise<Venue | null> => {
    const venue = await ctx.db.get(args.id);
    if (!venue) return null;
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status, address: venue.address, coordinates: venue.coordinates, placeId: venue.placeId,
      description: venue.description, coverImageId: venue.coverImageId,
    };
  },
});
```

- [ ] **Step 5: Run codegen and typecheck**

```bash
pnpm --filter @openschedule/convex exec pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: typecheck passes with only the 2 pre-existing errors (auth.ts:15, triggers.ts:3).

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/types/venues.queries.ts packages/convex/src/queries/venues.ts
git commit -m "feat(convex): add description and coverImageId to org and venue schema"
```

---

## Task 2: Update mutations to accept new fields

**Files:**
- Modify: `packages/convex/src/mutations/organizations.ts:29-61`
- Modify: `packages/convex/src/mutations/venues.ts:5-34` (create)
- Modify: `packages/convex/src/mutations/venues.ts:36-80` (update)

- [ ] **Step 1: Add `description` to organizations update mutation**

Replace the `update` export in `packages/convex/src/mutations/organizations.ts`:

```ts
export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
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
    if (fields.description !== undefined) patch.description = fields.description;
    await ctx.db.patch(id, patch);
  },
});
```

- [ ] **Step 2: Add `description` and `coverImageId` to venues create mutation**

Replace the `create` export in `packages/convex/src/mutations/venues.ts`:

```ts
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    placeId: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
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
```

- [ ] **Step 3: Add `description` and `coverImageId` to venues update mutation**

Replace the `update` export in `packages/convex/src/mutations/venues.ts`:

```ts
export const update = mutation({
  args: {
    id: v.id("venues"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    timezone: v.optional(v.string()),
    capacity: v.optional(v.number()),
    dayStart: v.optional(v.string()),
    dayEnd: v.optional(v.string()),
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    placeId: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
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
    const patch: Record<string, string | number | { lat: number; lng: number }> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(id, patch);
  },
});
```

- [ ] **Step 4: Run codegen and typecheck**

```bash
pnpm --filter @openschedule/convex exec pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
```

Expected: passes with only pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/mutations/organizations.ts packages/convex/src/mutations/venues.ts
git commit -m "feat(convex): accept description and coverImageId in org/venue mutations"
```

---

## Task 3: New public queries (listPublicDirectory + searchDirectory)

**Files:**
- Create: `packages/convex/src/queries/directory.ts`
- Create: `packages/convex/src/tests/directory.test.ts`

- [ ] **Step 1: Write the test file for directory queries**

Create `packages/convex/src/tests/directory.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupDirectoryData(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "org-auth-1",
      name: "Wellness Studio",
      slug: "wellness-studio",
      description: "A great wellness place",
    });
    const orgId2 = await ctx.db.insert("organizations", {
      authId: "org-auth-2",
      name: "Zen Spa",
      slug: "zen-spa",
    });
    const venueId1 = await ctx.db.insert("venues", {
      orgId,
      name: "Downtown Branch",
      slug: "downtown",
      timezone: "America/New_York",
      capacity: 5,
      dayStart: "09:00",
      dayEnd: "17:00",
      address: "123 Main St",
      status: "active",
      description: "Our main location",
    });
    const venueId2 = await ctx.db.insert("venues", {
      orgId: orgId2,
      name: "Zen Retreat",
      slug: "retreat",
      timezone: "America/Los_Angeles",
      capacity: 3,
      dayStart: "10:00",
      dayEnd: "18:00",
      status: "active",
    });
    const archivedVenueId = await ctx.db.insert("venues", {
      orgId,
      name: "Closed Branch",
      slug: "closed",
      timezone: "America/New_York",
      capacity: 2,
      dayStart: "09:00",
      dayEnd: "17:00",
      status: "archived",
    });
    return { orgId, orgId2, venueId1, venueId2, archivedVenueId };
  });
}

describe("directory queries", () => {
  test("listPublicDirectory returns only active venues with org info", async () => {
    const t = convexTest(schema, modules);
    const { venueId1, venueId2, archivedVenueId } = await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.listPublicDirectory, {});

    // Should include the 2 active venues but not the archived one
    expect(results.length).toBe(2);
    const ids = results.map((r: { _id: string }) => r._id);
    expect(ids).toContain(venueId1);
    expect(ids).toContain(venueId2);
    expect(ids).not.toContain(archivedVenueId);

    // Check shape of first result
    const downtown = results.find((r: { _id: string }) => r._id === venueId1);
    expect(downtown).toMatchObject({
      name: "Downtown Branch",
      slug: "downtown",
      address: "123 Main St",
      description: "Our main location",
      org: {
        name: "Wellness Studio",
        slug: "wellness-studio",
        description: "A great wellness place",
      },
    });
  });

  test("searchDirectory filters by venue name (case-insensitive)", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "downtown" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Downtown Branch");
  });

  test("searchDirectory filters by org name (case-insensitive)", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "zen" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Zen Retreat");
  });

  test("searchDirectory returns empty array for no matches", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "nonexistent" });
    expect(results.length).toBe(0);
  });

  test("searchDirectory does not return archived venues", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "closed" });
    expect(results.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @openschedule/convex exec vitest run src/tests/directory.test.ts
```

Expected: FAIL — module `api.queries.directory` does not exist yet.

- [ ] **Step 3: Implement directory queries**

Create `packages/convex/src/queries/directory.ts`:

```ts
import { v } from "convex/values";
import { query } from "../_generated/server";

interface DirectoryVenue {
  _id: string;
  name: string;
  slug: string;
  address?: string;
  description?: string;
  coverImageUrl?: string | null;
  org: {
    _id: string;
    name: string;
    slug: string;
    description?: string;
  };
}

export const listPublicDirectory = query({
  args: {},
  handler: async (ctx): Promise<DirectoryVenue[]> => {
    const venues = await ctx.db.query("venues").take(200);
    const activeVenues = venues.filter((v) => v.status === "active").slice(0, 50);

    const results: DirectoryVenue[] = [];
    for (const venue of activeVenues) {
      const org = await ctx.db.get(venue.orgId);
      if (!org) continue;

      let coverImageUrl: string | null = null;
      if (venue.coverImageId) {
        coverImageUrl = await ctx.storage.getUrl(venue.coverImageId);
      }

      results.push({
        _id: venue._id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        description: venue.description,
        coverImageUrl,
        org: {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          description: org.description,
        },
      });
    }
    return results;
  },
});

export const searchDirectory = query({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<DirectoryVenue[]> => {
    const searchTerm = args.query.toLowerCase();
    if (!searchTerm) return [];

    const venues = await ctx.db.query("venues").take(200);
    const activeVenues = venues.filter((v) => v.status === "active");

    const results: DirectoryVenue[] = [];
    for (const venue of activeVenues) {
      if (results.length >= 20) break;

      const org = await ctx.db.get(venue.orgId);
      if (!org) continue;

      const venueNameMatch = venue.name.toLowerCase().includes(searchTerm);
      const orgNameMatch = org.name.toLowerCase().includes(searchTerm);

      if (!venueNameMatch && !orgNameMatch) continue;

      let coverImageUrl: string | null = null;
      if (venue.coverImageId) {
        coverImageUrl = await ctx.storage.getUrl(venue.coverImageId);
      }

      results.push({
        _id: venue._id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        description: venue.description,
        coverImageUrl,
        org: {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          description: org.description,
        },
      });
    }
    return results;
  },
});
```

- [ ] **Step 4: Run codegen**

```bash
pnpm --filter @openschedule/convex exec pnpm dlx convex codegen
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @openschedule/convex exec vitest run src/tests/directory.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
pnpm --filter @openschedule/convex exec vitest run
```

Expected: 46/46 tests pass (existing 41 + 5 new).

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: passes with only pre-existing errors.

- [ ] **Step 8: Commit**

```bash
git add packages/convex/src/queries/directory.ts packages/convex/src/tests/directory.test.ts
git commit -m "feat(convex): add public directory queries for landing page"
```

---

## Task 4: Admin UI — org description field

**Files:**
- Modify: `apps/admin/lib/convex-api.ts` (organizations types)
- Modify: `apps/admin/components/org-settings-form.tsx`

- [ ] **Step 1: Update convex-api.ts — add description to organizations types**

In `apps/admin/lib/convex-api.ts`, update the `organizations` query return types and the mutations section.

Replace the `organizations` section under `queries` (lines 12-25):

```ts
    organizations: {
      getBySlug: FunctionReference<"query", "public", { slug: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
      } | null>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
      } | null>;
    };
```

Add an `organizations` section under `mutations` (after the existing `generateUploadUrl` block, before the closing `};`):

```ts
    organizations: {
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        description?: string;
      }, void>;
    };
```

Also update the `venues.update` mutation type to include new fields:

```ts
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        timezone?: string;
        capacity?: number;
        dayStart?: string;
        dayEnd?: string;
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
      }, void>;
```

And update `venues.create` mutation type:

```ts
      create: FunctionReference<"mutation", "public", {
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
      }, string>;
```

And update `venues.getBySlugFull` query return type to include the new fields:

```ts
      getBySlugFull: FunctionReference<"query", "public", { orgId: string; slug: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        status: "active" | "archived";
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
      } | null>;
```

- [ ] **Step 2: Add org description textarea to org-settings-form.tsx**

In `apps/admin/components/org-settings-form.tsx`, add the following changes:

1. Add the `Textarea` import at the top:

```ts
import { Textarea } from "@openschedule/ui/components/textarea";
```

2. Add state and mutation after the existing state declarations (after line 30):

```ts
  const [orgDescription, setOrgDescription] = useState("");
  const updateOrg = useMutation(convexApi.mutations.organizations.update);
```

3. Add the organization query to get current org data (after `generateUploadUrl`):

```ts
  const org = useQuery(convexApi.queries.organizations.get, { id: orgId });
```

4. Inside the initialization block (`if (settings !== undefined && !isInitialized)`), add after `setLogoStorageId`:

```ts
      if (org) {
        setOrgDescription(org.description ?? "");
      }
```

5. Inside `handleSave`, after the `upsertSettings` call, add:

```ts
      await updateOrg({
        id: orgId as any,
        description: orgDescription || undefined,
      });
```

6. Add the description textarea in the JSX, after the Contact Phone field and before the Logo upload section:

```tsx
          <div className="space-y-1">
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="Short description of your business (max 200 characters)"
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {orgDescription.length}/200
            </p>
          </div>
```

- [ ] **Step 3: Typecheck admin app**

```bash
pnpm --filter admin typecheck
```

Expected: passes (possibly with pre-existing errors only).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/lib/convex-api.ts apps/admin/components/org-settings-form.tsx
git commit -m "feat(admin): add org description field to settings form"
```

---

## Task 5: Admin UI — venue description + cover image

**Files:**
- Modify: `apps/admin/components/venue-settings-page.tsx`

- [ ] **Step 1: Add imports for Textarea and file upload ref**

At the top of `apps/admin/components/venue-settings-page.tsx`, add `useRef` to the React import and add Textarea:

```ts
import { useState, useRef } from "react";
```

```ts
import { Textarea } from "@openschedule/ui/components/textarea";
```

- [ ] **Step 2: Add state variables for description and cover image**

After the `placeId` state declaration (line 54), add:

```ts
  const [description, setDescription] = useState("");
  const [coverImageId, setCoverImageId] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
```

Add the mutations after the existing `archiveVenue` declaration:

```ts
  const generateUploadUrl = useMutation(convexApi.mutations.generateUploadUrl.generateUploadUrl);
```

- [ ] **Step 3: Initialize new state from venue data**

Inside the initialization block (`if (venue && !isInitialized)`), after `setPlaceId(venue.placeId ?? null)`, add:

```ts
    setDescription(venue.description ?? "");
    setCoverImageId(venue.coverImageId ?? null);
```

- [ ] **Step 4: Add cover image upload handler**

After the `handleArchive` function, add:

```ts
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      setCoverImageId(storageId);
      setCoverPreviewUrl(URL.createObjectURL(file));
    } catch {
      // Upload error — silently ignore, user can retry
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveCover() {
    setCoverImageId(null);
    setCoverPreviewUrl(null);
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
  }
```

- [ ] **Step 5: Update handleSave to include new fields**

Replace the `handleSave` function body to include description and coverImageId:

```ts
  async function handleSave() {
    if (!venue) return;
    setIsSaving(true);
    try {
      await updateVenue({
        id: venue._id,
        name: venueName,
        timezone,
        capacity,
        dayStart,
        dayEnd,
        address: address || undefined,
        coordinates: coordinates || undefined,
        placeId: placeId || undefined,
        description: description || undefined,
        coverImageId: coverImageId || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }
```

- [ ] **Step 6: Add description and cover image fields to the JSX**

After the Address `<div>` block (after `</AddressAutocomplete>` closing div, before the buttons), add:

```tsx
          <div className="space-y-1">
            <Label htmlFor="venue-description">Description</Label>
            <Textarea
              id="venue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short venue description (max 200 characters)"
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/200
            </p>
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>
            {(coverPreviewUrl || coverImageId) && (
              <div className="flex items-center gap-3">
                <div className="h-16 w-28 overflow-hidden rounded-md border bg-muted">
                  {coverPreviewUrl ? (
                    <img src={coverPreviewUrl} alt="Cover preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Cover
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveCover}>
                  Remove
                </Button>
              </div>
            )}
            <Input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              disabled={isUploading}
            />
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          </div>
```

- [ ] **Step 7: Typecheck admin app**

```bash
pnpm --filter admin typecheck
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/components/venue-settings-page.tsx
git commit -m "feat(admin): add description and cover image to venue settings"
```

---

## Task 6: Customer landing page — components

**Files:**
- Create: `apps/web/components/venue-directory-card.tsx`
- Create: `apps/web/components/search-input.tsx`
- Create: `apps/web/components/paste-link-input.tsx`
- Create: `apps/web/components/business-carousel.tsx`
- Create: `apps/web/components/landing-hero.tsx`

- [ ] **Step 1: Create VenueDirectoryCard component**

Create `apps/web/components/venue-directory-card.tsx`:

```tsx
"use client"

import Link from "next/link"

interface VenueDirectoryCardProps {
  venue: {
    _id: string
    name: string
    slug: string
    address?: string
    description?: string
    coverImageUrl?: string | null
    org: {
      _id: string
      name: string
      slug: string
      description?: string
    }
  }
}

export function VenueDirectoryCard({ venue }: VenueDirectoryCardProps) {
  const href = `/${venue.org.slug}/${venue.slug}`
  const showVenueName = venue.name !== venue.org.name

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      {/* Cover image or gradient placeholder */}
      <div className="h-[240px] w-full overflow-hidden">
        {venue.coverImageUrl ? (
          <img
            src={venue.coverImageUrl}
            alt={`${venue.name} cover`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
        )}
      </div>

      {/* Card content */}
      <div className="space-y-1 p-4">
        <p className="text-sm font-bold">{venue.org.name}</p>
        {showVenueName && (
          <p className="text-sm text-foreground">{venue.name}</p>
        )}
        {venue.address && (
          <p className="truncate text-xs text-muted-foreground">{venue.address}</p>
        )}
        {venue.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {venue.description}
          </p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Create SearchInput component**

Create `apps/web/components/search-input.tsx`:

```tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Input } from "@openschedule/ui/components/input"

const convexApi = api as unknown as {
  queries: {
    directory: {
      searchDirectory: FunctionReference<"query">
    }
  }
}

interface SearchResult {
  _id: string
  name: string
  slug: string
  address?: string
  org: {
    _id: string
    name: string
    slug: string
  }
}

export function SearchInput() {
  const router = useRouter()
  const [inputValue, setInputValue] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const results: SearchResult[] | undefined = useQuery(
    convexApi.queries.directory.searchDirectory,
    debouncedQuery ? { query: debouncedQuery } : "skip",
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(result: SearchResult) {
    setIsOpen(false)
    setInputValue("")
    router.push(`/${result.org.slug}/${result.slug}`)
  }

  const showDropdown = isOpen && debouncedQuery.length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <Input
          type="text"
          placeholder="Search businesses..."
          className="pl-10"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          aria-label="Search businesses"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          role="combobox"
          aria-autocomplete="list"
        />
      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          {results === undefined && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {results !== undefined && results.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No businesses found
            </div>
          )}
          {results !== undefined && results.length > 0 && (
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((result) => (
                <li key={result._id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent"
                    onClick={() => handleSelect(result)}
                    role="option"
                    aria-selected={false}
                  >
                    <p className="text-sm font-medium">{result.org.name}</p>
                    {result.name !== result.org.name && (
                      <p className="text-xs text-foreground">{result.name}</p>
                    )}
                    {result.address && (
                      <p className="truncate text-xs text-muted-foreground">
                        {result.address}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create PasteLinkInput component**

Create `apps/web/components/paste-link-input.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@openschedule/ui/components/input"
import { Button } from "@openschedule/ui/components/button"

export function PasteLinkInput() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [link, setLink] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleGo() {
    setError(null)

    // Try to parse the URL path to extract /:orgSlug/:venueSlug
    let pathname = link.trim()

    // If it looks like a full URL, extract the pathname
    if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
      try {
        const url = new URL(pathname)
        pathname = url.pathname
      } catch {
        setError("Invalid booking link format")
        return
      }
    }

    // Remove leading slash
    if (pathname.startsWith("/")) {
      pathname = pathname.slice(1)
    }

    // Remove trailing slash
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1)
    }

    const segments = pathname.split("/")
    if (segments.length < 2 || !segments[0] || !segments[1]) {
      setError("Invalid booking link format")
      return
    }

    const orgSlug = segments[0]
    const venueSlug = segments[1]

    router.push(`/${orgSlug}/${venueSlug}`)
  }

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Have a booking link? Paste it here
      </button>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Paste your booking link..."
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleGo()
          }}
          aria-label="Booking link"
        />
        <Button size="sm" onClick={handleGo} disabled={!link.trim()}>
          Go
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create BusinessCarousel component**

Create `apps/web/components/business-carousel.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { VenueDirectoryCard } from "./venue-directory-card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

const convexApi = api as unknown as {
  queries: {
    directory: {
      listPublicDirectory: FunctionReference<"query">
    }
  }
}

interface DirectoryVenue {
  _id: string
  name: string
  slug: string
  address?: string
  description?: string
  coverImageUrl?: string | null
  org: {
    _id: string
    name: string
    slug: string
    description?: string
  }
}

export function BusinessCarousel() {
  const venues: DirectoryVenue[] | undefined = useQuery(
    convexApi.queries.directory.listPublicDirectory,
    {},
  )

  if (venues === undefined) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Browse businesses</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] rounded-lg" />
          ))}
        </div>
      </section>
    )
  }

  if (venues.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Browse businesses</h2>
        <p className="text-sm text-muted-foreground">
          No businesses registered yet.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Browse businesses</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <VenueDirectoryCard key={venue._id} venue={venue} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create LandingHero component**

Create `apps/web/components/landing-hero.tsx`:

```tsx
"use client"

import { SearchInput } from "./search-input"
import { PasteLinkInput } from "./paste-link-input"

export function LandingHero() {
  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Book wellness services nearby
        </h1>
        <p className="text-muted-foreground">
          Discover studios and book your next appointment
        </p>
      </div>

      <SearchInput />

      <PasteLinkInput />
    </section>
  )
}
```

- [ ] **Step 6: Typecheck web app**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/landing-hero.tsx apps/web/components/search-input.tsx apps/web/components/paste-link-input.tsx apps/web/components/business-carousel.tsx apps/web/components/venue-directory-card.tsx
git commit -m "feat(web): add landing page components (hero, search, carousel, cards)"
```

---

## Task 7: Wire landing page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace placeholder with landing page**

Replace `apps/web/app/page.tsx` entirely:

```tsx
import { LandingHero } from "@/components/landing-hero"
import { BusinessCarousel } from "@/components/business-carousel"

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LandingHero />
      <BusinessCarousel />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck web app**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): replace placeholder with business directory landing page"
```

---

## Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all typechecks**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter web typecheck
pnpm --filter admin typecheck
```

Expected: each passes with only pre-existing errors (auth.ts:15 authComponent, triggers.ts:3 onCreate).

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @openschedule/convex exec vitest run
```

Expected: all tests pass (existing 41 + 5 new directory tests = 46 total, or more if other tests were added).

- [ ] **Step 3: Fix lint issues if any**

```bash
pnpm --filter @openschedule/convex exec pnpm dlx convex codegen
```

If there are formatting issues, fix and commit:

```bash
git add -A
git commit -m "chore: fix lint and formatting"
```

- [ ] **Step 4: Verify git status is clean**

```bash
git status
git log --oneline -10
```

Expected: all tasks committed, working tree clean.

---

## Summary of Commits

1. `feat(convex): add description and coverImageId to org and venue schema`
2. `feat(convex): accept description and coverImageId in org/venue mutations`
3. `feat(convex): add public directory queries for landing page`
4. `feat(admin): add org description field to settings form`
5. `feat(admin): add description and cover image to venue settings`
6. `feat(web): add landing page components (hero, search, carousel, cards)`
7. `feat(web): replace placeholder with business directory landing page`
8. (optional) `chore: fix lint and formatting`
