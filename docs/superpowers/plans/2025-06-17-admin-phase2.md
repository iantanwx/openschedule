# Admin Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add therapist invitations, blockout CRUD with soft-delete, org settings with logo upload, email delivery via Resend, and role-scoped views (My/All toggle) to the admin app.

**Architecture:** Backend changes live in `packages/convex` (queries, mutations, actions). Email is fire-and-forget via `ctx.scheduler.runAfter`. The `sendInvitationEmail` callback in better-auth calls Resend directly (auth routes run as HTTP actions). UI changes in `apps/admin` add team management, blockout UI, org settings form, and a view toggle for therapist scoping.

**Tech Stack:** Convex (backend), Resend (email via fetch), better-auth (invitations), Next.js 16 (admin UI), shadcn/radix-nova (components), vitest + convex-test (testing)

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `packages/convex/src/queries/settings.ts` | `getByOrg` query for org settings |
| `packages/convex/src/mutations/settings.ts` | `upsert` mutation (owner only) |
| `packages/convex/src/actions/email.ts` | Resend HTTP wrapper |
| `packages/convex/src/actions/sendBookingNotification.ts` | Internal action: resolve booking data, format + send |
| `packages/convex/src/actions/sendInvitationEmail.ts` | Internal action: format invite email, send |
| `packages/convex/src/actions/generateUploadUrl.ts` | Action returning file storage upload URL |
| `packages/convex/src/types/settings.queries.ts` | DTO type for settings query |
| `packages/convex/src/types/settings.mutations.ts` | Input type for settings upsert |
| `packages/convex/src/tests/blockouts.test.ts` | Blockout soft-delete, activate, validation tests |
| `packages/convex/src/tests/settings.test.ts` | Settings CRUD tests |
| `apps/admin/components/team-section.tsx` | Member list + invite form + pending invites |
| `apps/admin/components/blockout-list.tsx` | Blockout cards |
| `apps/admin/components/blockout-form.tsx` | Add/edit blockout dialog |
| `apps/admin/components/org-settings-form.tsx` | Business info + notification toggle + logo upload |
| `apps/admin/components/view-toggle.tsx` | "My / All" segmented control |

### Modified Files
| File | Changes |
|------|---------|
| `packages/convex/src/mutations/blockouts.ts` | Soft-delete in `remove`, add `activate`, add validation |
| `packages/convex/src/queries/blockouts.ts` | Filter by `status === "active"`, add `status` to DTO |
| `packages/convex/src/types/blockouts.queries.ts` | Add `status` field |
| `packages/convex/src/queries/users.ts` | Add `getSelf` query |
| `packages/convex/src/mutations/bookings.ts` | Schedule email action after confirm/cancel/reschedule |
| `packages/convex/src/betterAuth/auth.ts` | Add `sendInvitationEmail` callback |
| `apps/admin/lib/convex-api.ts` | Add type entries for new endpoints |
| `apps/admin/components/settings-page.tsx` | Add Team + Org Settings sections, role-scope |
| `apps/admin/components/schedule-page.tsx` | Add Blockouts section |
| `apps/admin/components/today-page.tsx` | Add view toggle for therapists |
| `apps/admin/components/bookings-page.tsx` | Add view toggle for therapists |
| `apps/admin/components/booking-detail-modal.tsx` | Hide actions in read-only mode |

---

### Task 1: Backend — Blockout Soft-Delete, Activate, Validation

**Files:**
- Modify: `packages/convex/src/mutations/blockouts.ts`
- Modify: `packages/convex/src/queries/blockouts.ts`
- Modify: `packages/convex/src/types/blockouts.queries.ts`
- Create: `packages/convex/src/tests/blockouts.test.ts`

- [ ] **Step 1: Update blockout DTO type to include `status`**

In `packages/convex/src/types/blockouts.queries.ts`:

```typescript
import { Doc } from "../_generated/dataModel";

/** Full blockout */
export type Blockout = Pick<Doc<"blockouts">, "_id" | "_creationTime" | "therapistId" | "date" | "startTime" | "endTime" | "reason" | "status">;
```

- [ ] **Step 2: Write failing tests for blockout mutations**

Create `packages/convex/src/tests/blockouts.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupOrg(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "test-org-auth",
      name: "Test Org",
      slug: "test-org",
    });
    const therapistId = await ctx.db.insert("users", {
      authId: "test-therapist-auth",
      email: "therapist@test.com",
      name: "Jane",
      role: "therapist",
      orgId,
    });
    return { orgId, therapistId };
  });
}

describe("blockout mutations", () => {
  test("remove sets status to inactive (soft-delete)", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    const blockoutId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Training",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: blockoutId });

    // Verify it's soft-deleted, not hard-deleted
    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(blockoutId);
    });
    expect(doc).not.toBeNull();
    expect(doc?.status).toBe("inactive");
  });

  test("activate restores an inactive blockout to active", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    const blockoutId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: blockoutId });
    await asTherapist.mutation(api.mutations.blockouts.activate, { id: blockoutId });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(blockoutId);
    });
    expect(doc?.status).toBe("active");
  });

  test("listByTherapist returns only active blockouts", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Active one",
    });

    const inactiveId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-02",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Will be removed",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: inactiveId });

    const results = await t.query(api.queries.blockouts.listByTherapist, { therapistId });
    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe("Active one");
  });

  test("listByTherapistAndDateRange returns only active blockouts", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-05",
      startTime: "09:00",
      endTime: "11:00",
    });

    const inactiveId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-06",
      startTime: "09:00",
      endTime: "11:00",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: inactiveId });

    const results = await t.query(api.queries.blockouts.listByTherapistAndDateRange, {
      therapistId,
      startDate: "2099-12-01",
      endDate: "2099-12-31",
    });
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe("2099-12-05");
  });

  test("cannot create blockout with startTime >= endTime", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.blockouts.create, {
        therapistId,
        date: "2099-12-01",
        startTime: "14:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow("Start time must be before end time");
  });

  test("cannot create blockout in the past", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.blockouts.create, {
        therapistId,
        date: "2020-01-01",
        startTime: "10:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow("Cannot create a blockout in the past");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/tests/blockouts.test.ts` (from `packages/convex`)
Expected: Multiple failures (activate not defined, remove still hard-deletes, no validation)

- [ ] **Step 4: Implement blockout mutation changes**

Replace `packages/convex/src/mutations/blockouts.ts`:

```typescript
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
    assertRole(user, ["owner", "therapist"]);

    if (user.role === "therapist" && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    // Validate: startTime must be before endTime
    if (args.startTime >= args.endTime) {
      throw new Error("Start time must be before end time");
    }

    // Validate: cannot create blockout in the past
    const today = new Date().toISOString().split("T")[0] ?? "";
    if (args.date < today) {
      throw new Error("Cannot create a blockout in the past");
    }

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
    assertRole(user, ["owner", "therapist"]);

    const { id, ...fields } = args;
    const blockout = await ctx.db.get(id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    // Build patch from defined fields
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Validate time ordering if both are provided or one is changing
    const finalStartTime = (patch.startTime ?? blockout.startTime) as string;
    const finalEndTime = (patch.endTime ?? blockout.endTime) as string;
    if (finalStartTime >= finalEndTime) {
      throw new Error("Start time must be before end time");
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    await ctx.db.patch(args.id, { status: "inactive" });
  },
});

export const activate = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    await ctx.db.patch(args.id, { status: "active" });
  },
});
```

- [ ] **Step 5: Update blockout queries to filter by active status**

Replace `packages/convex/src/queries/blockouts.ts`:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Blockout } from "../types/blockouts.queries";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args): Promise<Blockout[]> => {
    const blockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(200);
    return blockouts
      .filter((b) => b.status === "active")
      .map(({ _id, _creationTime, therapistId, date, startTime, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, date, startTime, endTime, reason, status,
      }));
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Blockout[]> => {
    const blockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(200);
    return blockouts
      .filter((b) => b.status === "active")
      .map(({ _id, _creationTime, therapistId, date, startTime, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, date, startTime, endTime, reason, status,
      }));
  },
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/tests/blockouts.test.ts` (from `packages/convex`)
Expected: All 6 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/convex/src/mutations/blockouts.ts packages/convex/src/queries/blockouts.ts packages/convex/src/types/blockouts.queries.ts packages/convex/src/tests/blockouts.test.ts
git commit -m "feat: blockout soft-delete, activate mutation, validation rules"
```

---

### Task 2: Backend — Settings CRUD

**Files:**
- Create: `packages/convex/src/queries/settings.ts`
- Create: `packages/convex/src/mutations/settings.ts`
- Create: `packages/convex/src/types/settings.queries.ts`
- Create: `packages/convex/src/types/settings.mutations.ts`
- Create: `packages/convex/src/tests/settings.test.ts`

- [ ] **Step 1: Create settings DTO types**

Create `packages/convex/src/types/settings.queries.ts`:

```typescript
export interface OrgSettings {
  businessName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoStorageId: string | null;
  emailNotificationsEnabled: boolean;
}
```

Create `packages/convex/src/types/settings.mutations.ts`:

```typescript
export interface OrgSettingsInput {
  businessName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoStorageId?: string | null;
  emailNotificationsEnabled?: boolean;
}
```

- [ ] **Step 2: Write failing tests for settings**

Create `packages/convex/src/tests/settings.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupOrgWithOwner(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "test-org-auth",
      name: "Test Org",
      slug: "test-org",
    });
    const ownerId = await ctx.db.insert("users", {
      authId: "test-owner-auth",
      email: "owner@test.com",
      name: "Owner",
      role: "owner",
      orgId,
    });
    const therapistId = await ctx.db.insert("users", {
      authId: "test-therapist-auth",
      email: "therapist@test.com",
      name: "Jane",
      role: "therapist",
      orgId,
    });
    return { orgId, ownerId, therapistId };
  });
}

describe("settings queries and mutations", () => {
  test("getByOrg returns null when no settings exist", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    const settings = await asOwner.query(api.queries.settings.getByOrg, {
      orgId,
    });
    expect(settings).toBeNull();
  });

  test("upsert creates settings on first call", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        businessName: "My Clinic",
        contactEmail: "hello@clinic.com",
        contactPhone: null,
        logoStorageId: null,
        emailNotificationsEnabled: false,
      },
    });

    const settings = await asOwner.query(api.queries.settings.getByOrg, {
      orgId,
    });
    expect(settings).toMatchObject({
      businessName: "My Clinic",
      contactEmail: "hello@clinic.com",
      contactPhone: null,
      logoStorageId: null,
      emailNotificationsEnabled: false,
    });
  });

  test("upsert patches existing settings on subsequent call", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        businessName: "My Clinic",
        contactEmail: "hello@clinic.com",
        contactPhone: null,
        logoStorageId: null,
        emailNotificationsEnabled: false,
      },
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        businessName: "My Clinic Updated",
        contactEmail: "hello@clinic.com",
        contactPhone: "+6591234567",
        logoStorageId: null,
        emailNotificationsEnabled: true,
      },
    });

    const settings = await asOwner.query(api.queries.settings.getByOrg, {
      orgId,
    });
    expect(settings).toMatchObject({
      businessName: "My Clinic Updated",
      contactPhone: "+6591234567",
      emailNotificationsEnabled: true,
    });
  });

  test("upsert rejects non-owner", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.settings.upsert, {
        orgId,
        data: {
          businessName: "Hacked",
          contactEmail: null,
          contactPhone: null,
          logoStorageId: null,
          emailNotificationsEnabled: false,
        },
      }),
    ).rejects.toThrow("Insufficient permissions");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/tests/settings.test.ts` (from `packages/convex`)
Expected: FAIL — modules not found

- [ ] **Step 4: Implement settings query**

Create `packages/convex/src/queries/settings.ts`:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import type { OrgSettings } from "../types/settings.queries";

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<OrgSettings | null> => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const doc = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();

    if (!doc) return null;

    const data = doc.data as OrgSettings;
    return {
      businessName: data.businessName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      logoStorageId: data.logoStorageId,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
    };
  },
});
```

- [ ] **Step 5: Implement settings mutation**

Create `packages/convex/src/mutations/settings.ts`:

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const upsert = mutation({
  args: {
    orgId: v.id("organizations"),
    data: v.object({
      businessName: v.string(),
      contactEmail: v.union(v.string(), v.null()),
      contactPhone: v.union(v.string(), v.null()),
      logoStorageId: v.union(v.id("_storage"), v.null()),
      emailNotificationsEnabled: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();

    // If replacing logo, delete old storage file
    if (existing) {
      const oldData = existing.data as { logoStorageId: string | null };
      if (oldData.logoStorageId && oldData.logoStorageId !== args.data.logoStorageId) {
        await ctx.storage.delete(oldData.logoStorageId as any);
      }
      await ctx.db.patch(existing._id, {
        data: args.data,
        version: existing.version + 1,
      });
    } else {
      await ctx.db.insert("settings", {
        scope: "org",
        scopeId: args.orgId,
        version: 1,
        data: args.data,
      });
    }
  },
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/tests/settings.test.ts` (from `packages/convex`)
Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/convex/src/queries/settings.ts packages/convex/src/mutations/settings.ts packages/convex/src/types/settings.queries.ts packages/convex/src/types/settings.mutations.ts packages/convex/src/tests/settings.test.ts
git commit -m "feat: settings CRUD (getByOrg query + upsert mutation)"
```

---

### Task 3: Backend — Email Action Infrastructure

**Files:**
- Create: `packages/convex/src/actions/email.ts`
- Create: `packages/convex/src/actions/sendBookingNotification.ts`
- Create: `packages/convex/src/actions/sendInvitationEmail.ts`

- [ ] **Step 1: Create the Resend HTTP wrapper**

Create `packages/convex/src/actions/email.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export interface EmailPayload {
  to: string[];
  subject: string;
  text: string;
}

/**
 * Sends an email via Resend HTTP API.
 * If RESEND_API_KEY is not set, logs the email content (dev mode).
 * Never throws — failed sends are logged but swallowed.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL ?? "noreply@openschedule.com";

  if (!apiKey) {
    console.log("[EMAIL DEV MODE] Would send email:");
    console.log(`  To: ${payload.to.join(", ")}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body: ${payload.text}`);
    return true;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[EMAIL ERROR] Resend API returned ${response.status}: ${errorBody}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL ERROR] Failed to send email:", error);
    return false;
  }
}
```

- [ ] **Step 2: Create sendBookingNotification internal action**

Create `packages/convex/src/actions/sendBookingNotification.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendEmail } from "./email";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    event: v.union(
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    // Resolve booking data
    const booking = await ctx.runQuery(internal.queries.bookings.getInternal, {
      id: args.bookingId,
    });
    if (!booking) {
      console.error(`[EMAIL] Booking ${args.bookingId} not found, skipping email`);
      return;
    }

    // Skip if already cancelled and event is not "cancelled"
    if (booking.status === "cancelled" && args.event !== "cancelled") {
      return;
    }

    // Check org notification settings
    const venue = await ctx.runQuery(internal.queries.venues.getInternal, {
      id: booking.venueId,
    });
    if (!venue) return;

    const settings = await ctx.runQuery(internal.queries.settings.getByOrgInternal, {
      orgId: venue.orgId,
    });

    // If notifications disabled, skip
    if (!settings || !settings.emailNotificationsEnabled) {
      return;
    }

    // Resolve customer and therapist
    const customer = await ctx.runQuery(internal.queries.customers.getInternal, {
      id: booking.customerId,
    });
    const therapist = await ctx.runQuery(internal.queries.users.getInternal, {
      id: booking.therapistId,
    });

    if (!customer || !therapist) return;

    const recipients = [customer.email, therapist.email].filter(Boolean);

    const subjectMap = {
      confirmed: `Booking confirmed — ${booking.date} at ${booking.startTime}`,
      cancelled: `Booking cancelled — ${booking.date} at ${booking.startTime}`,
      rescheduled: `Booking rescheduled — new time: ${booking.date} at ${booking.startTime}`,
    };

    const bodyMap = {
      confirmed: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been confirmed.`,
      cancelled: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been cancelled.`,
      rescheduled: `Your booking has been rescheduled to ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name}.`,
    };

    await sendEmail({
      to: recipients,
      subject: subjectMap[args.event],
      text: bodyMap[args.event],
    });
  },
});
```

- [ ] **Step 3: Create sendInvitationEmail internal action**

Create `packages/convex/src/actions/sendInvitationEmail.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { sendEmail } from "./email";

export const send = internalAction({
  args: {
    email: v.string(),
    inviterName: v.string(),
    organizationName: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    const acceptUrl = `${appUrl}/invite/${args.invitationId}`;

    await sendEmail({
      to: [args.email],
      subject: `You've been invited to join ${args.organizationName}`,
      text: [
        `Hi,`,
        ``,
        `${args.inviterName} has invited you to join ${args.organizationName} on OpenSchedule.`,
        ``,
        `Click the link below to accept the invitation:`,
        acceptUrl,
        ``,
        `If you don't have an account yet, you'll be prompted to create one.`,
      ].join("\n"),
    });
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/actions/email.ts packages/convex/src/actions/sendBookingNotification.ts packages/convex/src/actions/sendInvitationEmail.ts
git commit -m "feat: email action infrastructure (Resend wrapper + booking + invitation)"
```

---

### Task 4: Backend — Wire Email into Booking Mutations + Invitation Callback

**Files:**
- Modify: `packages/convex/src/mutations/bookings.ts`
- Modify: `packages/convex/src/betterAuth/auth.ts`
- Create: `packages/convex/src/queries/bookings.internal.ts` (internal query for action)
- Create: `packages/convex/src/queries/venues.internal.ts` (internal query for action)
- Create: `packages/convex/src/queries/settings.internal.ts` (internal query for action)
- Create: `packages/convex/src/queries/customers.internal.ts` (internal query for action)
- Create: `packages/convex/src/queries/users.internal.ts` (internal query for action)

- [ ] **Step 1: Create internal queries needed by actions**

These internal queries allow actions to resolve data without exposing public API.

Create `packages/convex/src/queries/bookings.internal.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/venues.internal.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/settings.internal.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { OrgSettings } from "../types/settings.queries";

export const getByOrgInternal = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<OrgSettings | null> => {
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();

    if (!doc) return null;

    const data = doc.data as OrgSettings;
    return {
      businessName: data.businessName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      logoStorageId: data.logoStorageId,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
    };
  },
});
```

Create `packages/convex/src/queries/customers.internal.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/users.internal.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 2: Update sendBookingNotification to use correct internal references**

The `internal` object uses file-based routing. Since internal queries live in `src/queries/bookings.internal.ts`, the reference is `internal.queries.bookings_internal.getInternal` (Convex converts dots to underscores in paths). However, this is awkward — a cleaner approach is to nest them in a subfolder.

**Actually**, Convex file-based routing uses the file name directly. A file at `src/queries/bookings.internal.ts` would register as `internal.queries["bookings.internal"].getInternal` which isn't valid JS. Let's use a different naming pattern.

**Revised approach:** Put internal queries in the same files with `internalQuery` exports, OR use a subfolder `src/queries/internal/`.

Let's use a subfolder: `packages/convex/src/queries/internal/`

Delete the files from Step 1 and instead create:

Create `packages/convex/src/queries/internal/bookings.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/internal/venues.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/internal/settings.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import type { OrgSettings } from "../../types/settings.queries";

export const getByOrgInternal = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<OrgSettings | null> => {
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();

    if (!doc) return null;

    const data = doc.data as OrgSettings;
    return {
      businessName: data.businessName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      logoStorageId: data.logoStorageId,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
    };
  },
});
```

Create `packages/convex/src/queries/internal/customers.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

Create `packages/convex/src/queries/internal/users.ts`:

```typescript
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 3: Update sendBookingNotification references**

Update `packages/convex/src/actions/sendBookingNotification.ts` to use the correct internal paths.

The file-based routing for `src/queries/internal/bookings.ts` exports `getInternal`, so the reference is: `internal.queries.internal.bookings.getInternal`.

Replace `packages/convex/src/actions/sendBookingNotification.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendEmail } from "./email";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    event: v.union(
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    // Resolve booking data
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(`[EMAIL] Booking ${args.bookingId} not found, skipping email`);
      return;
    }

    // Skip if already cancelled and event is not "cancelled"
    if (booking.status === "cancelled" && args.event !== "cancelled") {
      return;
    }

    // Check org notification settings
    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );

    // If notifications disabled, skip
    if (!settings || !settings.emailNotificationsEnabled) {
      return;
    }

    // Resolve customer and therapist
    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );

    if (!customer || !therapist) return;

    const recipients = [customer.email, therapist.email].filter(Boolean);

    const subjectMap = {
      confirmed: `Booking confirmed — ${booking.date} at ${booking.startTime}`,
      cancelled: `Booking cancelled — ${booking.date} at ${booking.startTime}`,
      rescheduled: `Booking rescheduled — new time: ${booking.date} at ${booking.startTime}`,
    };

    const bodyMap = {
      confirmed: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been confirmed.`,
      cancelled: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been cancelled.`,
      rescheduled: `Your booking has been rescheduled to ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name}.`,
    };

    await sendEmail({
      to: recipients,
      subject: subjectMap[args.event],
      text: bodyMap[args.event],
    });
  },
});
```

- [ ] **Step 4: Wire email scheduling into booking mutations**

Update `packages/convex/src/mutations/bookings.ts` — add import and schedule calls after `confirm`, `cancel`, and `reschedule`:

Add at the top of the file:

```typescript
import { internal } from "../_generated/api";
```

In the `confirm` handler, after `await ctx.db.patch(args.id, { status: "confirmed" });`:

```typescript
    await ctx.db.patch(args.id, { status: "confirmed" });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "confirmed",
    });
```

In the `cancel` handler, after `await ctx.db.patch(args.id, { status: "cancelled" });`:

```typescript
    await ctx.db.patch(args.id, { status: "cancelled" });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "cancelled",
    });
```

In the `reschedule` handler, after the final `ctx.db.patch`:

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

The full updated `packages/convex/src/mutations/bookings.ts`:

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { timeRangesOverlap } from "../lib/time";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    venueId: v.id("venues"),
    therapistId: v.id("users"),
    customerId: v.id("customers"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    createdBy: v.union(
      v.literal("customer"),
      v.literal("therapist"),
      v.literal("owner"),
    ),
    overCapacity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }

    if (args.overCapacity) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required for capacity override");
      }
      const authUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
        .unique();
      if (!authUser || authUser.role !== "owner") {
        throw new Error("Only owners can override venue capacity");
      }
    }

    // Check therapist isn't already booked for this slot
    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", args.therapistId).eq("date", args.date),
      )
      .take(100);

    const conflictingBooking = therapistBookings.find(
      (b) =>
        b.status !== "cancelled" &&
        timeRangesOverlap(b.startTime, b.endTime, args.startTime, args.endTime),
    );
    if (conflictingBooking) {
      throw new Error("Therapist already has a booking at this time");
    }

    // Check venue capacity (unless overCapacity is explicitly set)
    if (!args.overCapacity) {
      const venueBookings = await ctx.db
        .query("bookings")
        .withIndex("by_venueId_and_date", (q) =>
          q.eq("venueId", args.venueId).eq("date", args.date),
        )
        .take(200);

      const overlappingCount = venueBookings.filter(
        (b) =>
          b.status !== "cancelled" &&
          timeRangesOverlap(
            b.startTime,
            b.endTime,
            args.startTime,
            args.endTime,
          ),
      ).length;

      if (overlappingCount >= venue.capacity) {
        throw new Error("Venue is at capacity for this time slot");
      }
    }

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
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "confirmed",
    });
  },
});

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

export const reschedule = mutation({
  args: {
    id: v.id("bookings"),
    newDate: v.string(),
    newStartTime: v.string(),
    newEndTime: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify org access via venue
    const venue = await ctx.db.get(booking.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }
    assertOrgAccess(user, venue.orgId);

    // Therapists can only reschedule their own bookings
    if (user.role === "therapist" && user._id.toString() !== booking.therapistId.toString()) {
      throw new Error("Therapists can only reschedule their own bookings");
    }

    if (booking.status === "cancelled") {
      throw new Error("Cannot reschedule a cancelled booking");
    }

    // Check therapist isn't double-booked at new time (exclude current booking)
    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", booking.therapistId).eq("date", args.newDate),
      )
      .take(100);

    const conflictingBooking = therapistBookings.find(
      (b) =>
        b._id.toString() !== args.id.toString() &&
        b.status !== "cancelled" &&
        timeRangesOverlap(b.startTime, b.endTime, args.newStartTime, args.newEndTime),
    );
    if (conflictingBooking) {
      throw new Error("Therapist already has a booking at this time");
    }

    // Check venue capacity (unless original was over-capacity)
    if (!booking.overCapacity) {
      const venueBookings = await ctx.db
        .query("bookings")
        .withIndex("by_venueId_and_date", (q) =>
          q.eq("venueId", booking.venueId).eq("date", args.newDate),
        )
        .take(200);

      const overlappingCount = venueBookings.filter(
        (b) =>
          b._id.toString() !== args.id.toString() &&
          b.status !== "cancelled" &&
          timeRangesOverlap(b.startTime, b.endTime, args.newStartTime, args.newEndTime),
      ).length;

      if (overlappingCount >= venue.capacity) {
        throw new Error("Venue is at capacity for this time slot");
      }
    }

    await ctx.db.patch(args.id, {
      date: args.newDate,
      startTime: args.newStartTime,
      endTime: args.newEndTime,
    });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "rescheduled",
    });
  },
});
```

- [ ] **Step 5: Add sendInvitationEmail callback to auth.ts**

In `packages/convex/src/betterAuth/auth.ts`, update the `organization()` plugin config:

```typescript
    plugins: [
      convex({ authConfig }),
      organization({
        allowUserToCreateOrganization: true,
        async sendInvitationEmail(data) {
          const apiKey = process.env.RESEND_API_KEY;
          const from = process.env.FROM_EMAIL ?? "noreply@openschedule.com";
          const appUrl = process.env.APP_URL ?? "http://localhost:3001";
          const acceptUrl = `${appUrl}/invite/${data.id}`;

          const subject = `You've been invited to join ${data.organization.name}`;
          const text = [
            `Hi,`,
            ``,
            `${data.inviter.user.name} has invited you to join ${data.organization.name} on OpenSchedule.`,
            ``,
            `Click the link below to accept the invitation:`,
            acceptUrl,
            ``,
            `If you don't have an account yet, you'll be prompted to create one.`,
          ].join("\n");

          if (!apiKey) {
            console.log("[EMAIL DEV MODE] Invitation email:");
            console.log(`  To: ${data.email}`);
            console.log(`  Subject: ${subject}`);
            console.log(`  Body: ${text}`);
            console.log(`  Accept URL: ${acceptUrl}`);
            return;
          }

          try {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [data.email],
                subject,
                text,
              }),
            });

            if (!response.ok) {
              const errorBody = await response.text();
              console.error(`[EMAIL ERROR] Invitation email failed: ${response.status}: ${errorBody}`);
            }
          } catch (error) {
            console.error("[EMAIL ERROR] Failed to send invitation email:", error);
          }
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`Magic link for ${email}: ${url}`);
        },
      }),
    ],
```

- [ ] **Step 6: Run existing booking tests to confirm they still pass**

Run: `pnpm vitest run src/tests/bookings.test.ts` (from `packages/convex`)
Expected: All existing tests PASS (scheduler calls don't break existing tests in convex-test)

- [ ] **Step 7: Commit**

```bash
git add packages/convex/src/mutations/bookings.ts packages/convex/src/betterAuth/auth.ts packages/convex/src/queries/internal/ packages/convex/src/actions/sendBookingNotification.ts
git commit -m "feat: wire email into booking mutations and invitation callback"
```

---

### Task 5: Backend — `users.getSelf` Query + `generateUploadUrl` Action

**Files:**
- Modify: `packages/convex/src/queries/users.ts`
- Create: `packages/convex/src/actions/generateUploadUrl.ts`

- [ ] **Step 1: Add `getSelf` query to users.ts**

Append to `packages/convex/src/queries/users.ts`:

```typescript
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

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role ?? null,
      orgId: user.orgId ?? null,
    };
  },
});
```

The full `packages/convex/src/queries/users.ts`:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

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
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
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

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role ?? null,
      orgId: user.orgId ?? null,
    };
  },
});
```

- [ ] **Step 2: Create generateUploadUrl action**

Create `packages/convex/src/actions/generateUploadUrl.ts`:

```typescript
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    return await ctx.storage.generateUploadUrl();
  },
});
```

Note: `generateUploadUrl` is a mutation (not an action) because `ctx.storage.generateUploadUrl()` is available in mutations. This is the standard Convex pattern for upload URLs.

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/users.ts packages/convex/src/actions/generateUploadUrl.ts
git commit -m "feat: add users.getSelf query and generateUploadUrl mutation"
```

---

### Task 6: Admin — Update `convex-api.ts` Type Map

**Files:**
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Add new query and mutation type entries**

Replace `apps/admin/lib/convex-api.ts` with the full updated type map:

```typescript
// apps/admin/lib/convex-api.ts
import type { FunctionReference } from "convex/server";
import { api } from "@openschedule/convex/api";

/**
 * Typed Convex API map for the admin app.
 * FunctionReference cast required because FilterApi doesn't resolve across
 * package boundaries in this monorepo setup.
 */
export const convexApi = api as unknown as {
  queries: {
    organizations: {
      getBySlug: FunctionReference<"query", "public", { slug: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
      } | null>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
      } | null>;
    };
    venues: {
      listByOrg: FunctionReference<"query", "public", { orgId: string }, Array<{
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
      }>>;
      get: FunctionReference<"query", "public", { id: string }, {
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
      } | null>;
    };
    bookings: {
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      } | null>;
      listByVenueAndDate: FunctionReference<"query", "public", { venueId: string; date: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
      listByVenueDateRange: FunctionReference<"query", "public", { venueId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
      listByTherapistAndDateRange: FunctionReference<"query", "public", { therapistId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
    };
    schedules: {
      listByVenue: FunctionReference<"query", "public", { venueId: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        venueId: string;
        workingDays: number[];
        startTime: string;
        endTime: string;
        slotDuration: number;
        availabilityHorizonDays: number;
      }>>;
    };
    blockouts: {
      listByTherapist: FunctionReference<"query", "public", { therapistId: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        date: string;
        startTime: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
      listByTherapistAndDateRange: FunctionReference<"query", "public", { therapistId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        date: string;
        startTime: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
    };
    users: {
      getPublic: FunctionReference<"query", "public", { id: string }, { _id: string; name: string } | null>;
      listByVenue: FunctionReference<"query", "public", { venueId: string }, Array<{ _id: string; name: string }>>;
      getSelf: FunctionReference<"query", "public", Record<string, never>, {
        _id: string;
        name: string;
        email: string;
        role: "owner" | "therapist" | null;
        orgId: string | null;
      } | null>;
    };
    customers: {
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        email: string;
        name: string;
        phone?: string;
      } | null>;
    };
    availability: {
      getSlots: FunctionReference<"query", "public", { venueId: string; therapistId: string }, Record<string, Array<{ startTime: string; endTime: string }>>>;
    };
    settings: {
      getByOrg: FunctionReference<"query", "public", { orgId: string }, {
        businessName: string;
        contactEmail: string | null;
        contactPhone: string | null;
        logoStorageId: string | null;
        emailNotificationsEnabled: boolean;
      } | null>;
    };
  };
  mutations: {
    bookings: {
      create: FunctionReference<"mutation", "public", {
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        createdBy: "customer" | "therapist" | "owner";
        overCapacity?: boolean;
      }, string>;
      confirm: FunctionReference<"mutation", "public", { id: string }, void>;
      cancel: FunctionReference<"mutation", "public", { id: string }, void>;
      reschedule: FunctionReference<"mutation", "public", {
        id: string;
        newDate: string;
        newStartTime: string;
        newEndTime: string;
      }, void>;
    };
    customers: {
      getOrCreate: FunctionReference<"mutation", "public", {
        orgId: string;
        email: string;
        name: string;
        phone?: string;
      }, string>;
    };
    venues: {
      create: FunctionReference<"mutation", "public", {
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        timezone?: string;
        capacity?: number;
        dayStart?: string;
        dayEnd?: string;
      }, void>;
      archive: FunctionReference<"mutation", "public", { id: string }, void>;
      unarchive: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    schedules: {
      upsert: FunctionReference<"mutation", "public", {
        therapistId: string;
        venueId: string;
        workingDays: number[];
        startTime: string;
        endTime: string;
        slotDuration: number;
        availabilityHorizonDays: number;
      }, string>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    blockouts: {
      create: FunctionReference<"mutation", "public", {
        therapistId: string;
        date: string;
        startTime: string;
        endTime: string;
        reason?: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        date?: string;
        startTime?: string;
        endTime?: string;
        reason?: string;
      }, void>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
      activate: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    settings: {
      upsert: FunctionReference<"mutation", "public", {
        orgId: string;
        data: {
          businessName: string;
          contactEmail: string | null;
          contactPhone: string | null;
          logoStorageId: string | null;
          emailNotificationsEnabled: boolean;
        };
      }, void>;
    };
    generateUploadUrl: FunctionReference<"mutation", "public", Record<string, never>, string>;
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/lib/convex-api.ts
git commit -m "feat: update convex-api type map with Phase 2 endpoints"
```

---

### Task 7: Admin — View Toggle Component + Role Scoping for Today and Bookings

**Files:**
- Create: `apps/admin/components/view-toggle.tsx`
- Modify: `apps/admin/components/today-page.tsx`
- Modify: `apps/admin/components/bookings-page.tsx`
- Modify: `apps/admin/components/booking-detail-modal.tsx`

- [ ] **Step 1: Create the view toggle component**

Create `apps/admin/components/view-toggle.tsx`:

```tsx
"use client";

import { cn } from "@openschedule/ui/lib/utils";

interface ViewToggleProps {
  value: "my" | "all";
  onChange: (value: "my" | "all") => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label="View scope">
      <button
        type="button"
        role="radio"
        aria-checked={value === "my"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          value === "my"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("my")}
      >
        My
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "all"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          value === "all"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("all")}
      >
        All
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update TodayPage with role-scoped view toggle**

Replace `apps/admin/components/today-page.tsx`:

```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { format, addDays, subDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { TimeGrid } from "./time-grid";
import { DayNav } from "./day-nav";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";
import { Badge } from "@openschedule/ui/components/badge";

interface TodayPageProps {
  orgSlug: string;
}

export function TodayPage({ orgSlug }: TodayPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    venue ? { venueId: venue._id, date: selectedDate } : "skip",
  );

  const isTherapist = currentUser?.role === "therapist";
  const isOwner = currentUser?.role === "owner";

  // For therapists in "my" view, filter to only their bookings
  const displayedBookings = useMemo(() => {
    if (!bookings) return [];
    if (isOwner || (isTherapist && viewScope === "all")) {
      return bookings;
    }
    // Therapist "my" view
    if (isTherapist && currentUser) {
      return bookings.filter((b) => b.therapistId === currentUser._id);
    }
    return bookings;
  }, [bookings, isOwner, isTherapist, viewScope, currentUser]);

  // Read-only mode: therapist viewing "all"
  const isReadOnly = isTherapist && viewScope === "all";

  const handlePrev = useCallback(() => {
    setSelectedDate((d) => format(subDays(d, 1), "yyyy-MM-dd"));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedDate((d) => format(addDays(d, 1), "yyyy-MM-dd"));
  }, []);

  if (org === undefined || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No venue configured yet.</p>
          <p className="text-muted-foreground text-sm">Go to Settings to create your first venue.</p>
        </div>
      </div>
    );
  }

  const activeBookings = displayedBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="flex h-full flex-col">
      {/* Day nav */}
      <DayNav date={selectedDate} onPrev={handlePrev} onNext={handleNext} />

      {/* View toggle + stats banner */}
      <div className="flex items-center gap-2 px-4 pb-2">
        {isTherapist && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}
        <Badge variant="secondary">{activeBookings.length} bookings</Badge>
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
          {confirmedCount} confirmed
        </Badge>
        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
          {pendingCount} pending
        </Badge>
      </div>

      {/* Time grid */}
      <TimeGrid
        bookings={displayedBookings}
        dayStart={venue.dayStart}
        dayEnd={venue.dayEnd}
        onBookingTap={setSelectedBookingId}
      />

      {/* FAB */}
      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

      {/* Booking detail modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          readOnly={isReadOnly}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update BookingsPage with role-scoped view toggle**

Replace `apps/admin/components/bookings-page.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format, addDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { FilterBar } from "./filter-bar";
import { BookingCard } from "./booking-card";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";

interface BookingsPageProps {
  orgSlug: string;
}

type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

export function BookingsPage({ orgSlug }: BookingsPageProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [therapistFilter, setTherapistFilter] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  // Default range: today + 7 days
  const today = format(new Date(), "yyyy-MM-dd");
  const endDate = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueDateRange,
    venue ? { venueId: venue._id, startDate: today, endDate } : "skip",
  );

  const isTherapist = currentUser?.role === "therapist";
  const isOwner = currentUser?.role === "owner";
  const isReadOnly = isTherapist && viewScope === "all";

  // Client-side filtering
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];

    let filtered = bookings;

    // Scope by role
    if (isTherapist && viewScope === "my" && currentUser) {
      filtered = filtered.filter((b) => b.therapistId === currentUser._id);
    }

    return filtered
      .filter((b) => {
        if (statusFilter !== "all" && b.status !== statusFilter) return false;
        if (therapistFilter && b.therapistId !== therapistFilter) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by date descending, then startTime descending
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.startTime.localeCompare(a.startTime);
      });
  }, [bookings, statusFilter, therapistFilter, isTherapist, viewScope, currentUser]);

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-2">
        {isTherapist && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}
      </div>

      <FilterBar
        status={statusFilter}
        onStatusChange={setStatusFilter}
        therapistId={therapistFilter}
        onTherapistChange={setTherapistFilter}
        therapists={therapists ?? []}
        showTherapistFilter={isOwner || (isTherapist && viewScope === "all")}
      />

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {filteredBookings.length === 0 ? (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            No bookings match your filters.
          </p>
        ) : (
          filteredBookings.map((booking) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              onTap={setSelectedBookingId}
            />
          ))
        )}
      </div>

      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          readOnly={isReadOnly}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update BookingDetailModal to accept `readOnly` prop**

Replace `apps/admin/components/booking-detail-modal.tsx`:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { RescheduleView } from "./reschedule-view";
import { useState } from "react";
import { Button } from "@openschedule/ui/components/button";
import { Badge } from "@openschedule/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openschedule/ui/components/dialog";

interface BookingDetailModalProps {
  bookingId: string;
  venueId: string;
  readOnly?: boolean;
  onClose: () => void;
}

const STATUS_BADGE_VARIANT = {
  confirmed: "default" as const,
  pending: "secondary" as const,
  cancelled: "outline" as const,
};

export function BookingDetailModal({ bookingId, venueId, readOnly = false, onClose }: BookingDetailModalProps) {
  const [showReschedule, setShowReschedule] = useState(false);

  const booking = useQuery(convexApi.queries.bookings.get, { id: bookingId });
  const customer = useQuery(
    convexApi.queries.customers.get,
    booking ? { id: booking.customerId } : "skip",
  );
  const therapist = useQuery(
    convexApi.queries.users.getPublic,
    booking ? { id: booking.therapistId } : "skip",
  );

  const confirmMutation = useMutation(convexApi.mutations.bookings.confirm);
  const cancelMutation = useMutation(convexApi.mutations.bookings.cancel);

  if (!booking) {
    return null;
  }

  async function handleConfirm() {
    await confirmMutation({ id: bookingId });
  }

  async function handleCancel() {
    await cancelMutation({ id: bookingId });
  }

  if (showReschedule) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <RescheduleView
            bookingId={bookingId}
            therapistId={booking.therapistId}
            venueId={venueId}
            onDone={() => {
              setShowReschedule(false);
              onClose();
            }}
            onBack={() => setShowReschedule(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[booking.status]}>
              {booking.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created by {booking.createdBy}
            </span>
          </div>

          {/* Time info */}
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Date:</span> {booking.date}
            </p>
            <p>
              <span className="text-muted-foreground">Time:</span>{" "}
              {booking.startTime} – {booking.endTime}
            </p>
            <p>
              <span className="text-muted-foreground">Therapist:</span>{" "}
              {therapist?.name ?? "Loading..."}
            </p>
          </div>

          {/* Customer info */}
          <div className="space-y-1 text-sm">
            <p className="font-medium">Customer</p>
            <p>{customer?.name ?? "Loading..."}</p>
            {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          </div>

          {/* Actions — hidden in read-only mode */}
          {!readOnly && booking.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2 pt-2">
              {booking.status === "pending" && (
                <Button size="sm" onClick={handleConfirm}>
                  Confirm
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowReschedule(true)}>
                Reschedule
              </Button>
              <Button size="sm" variant="destructive" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/view-toggle.tsx apps/admin/components/today-page.tsx apps/admin/components/bookings-page.tsx apps/admin/components/booking-detail-modal.tsx
git commit -m "feat: add My/All view toggle with role scoping for therapists"
```

---

### Task 8: Admin — Team Section (Member List, Invite Form, Pending Invites)

**Files:**
- Create: `apps/admin/components/team-section.tsx`

- [ ] **Step 1: Create TeamSection component**

Create `apps/admin/components/team-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openschedule/ui/components/alert-dialog";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

export function TeamSection() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load members and invitations on mount
  useState(() => {
    loadData();
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        authClient.organization.listMembers(),
        authClient.organization.listInvitations(),
      ]);
      if (membersRes.data) {
        setMembers(membersRes.data as Member[]);
      }
      if (invitationsRes.data) {
        setInvitations(
          (invitationsRes.data as Invitation[]).filter((i) => i.status === "pending"),
        );
      }
    } catch (err) {
      console.error("Failed to load team data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsInviting(true);
    try {
      const result = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: "member",
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to send invitation");
      } else {
        setInviteEmail("");
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await authClient.organization.removeMember({ memberIdOrEmail: memberId });
      await loadData();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await authClient.organization.cancelInvitation({ invitationId });
      await loadData();
    } catch (err) {
      console.error("Failed to cancel invitation:", err);
    }
  }

  async function handleResendInvitation(invitationId: string) {
    try {
      await authClient.organization.inviteMember({
        email: invitations.find((i) => i.id === invitationId)?.email ?? "",
        role: "member",
        resend: true,
      });
    } catch (err) {
      console.error("Failed to resend invitation:", err);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Members */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Members</h4>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{member.user.name}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{member.role === "owner" ? "Owner" : "Therapist"}</Badge>
                    {member.role !== "owner" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {member.user.name} from the organization. Their active schedules will be deactivated and future bookings cancelled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveMember(member.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Pending Invitations</h4>
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invite Form */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Invite Therapist</h4>
          <form onSubmit={handleInvite} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="therapist@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={isInviting}>
              {isInviting ? "Inviting..." : "Invite as Therapist"}
            </Button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/components/team-section.tsx
git commit -m "feat: add TeamSection component (member list + invite form)"
```

---

### Task 9: Admin — Blockout UI (List + Form on Schedule Tab)

**Files:**
- Create: `apps/admin/components/blockout-list.tsx`
- Create: `apps/admin/components/blockout-form.tsx`
- Modify: `apps/admin/components/schedule-page.tsx`

- [ ] **Step 1: Create BlockoutList component**

Create `apps/admin/components/blockout-list.tsx`:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { format, isBefore, parseISO } from "date-fns";

interface BlockoutListProps {
  therapistId: string;
  onEdit: (blockoutId: string) => void;
}

export function BlockoutList({ therapistId, onEdit }: BlockoutListProps) {
  const blockouts = useQuery(
    convexApi.queries.blockouts.listByTherapist,
    { therapistId },
  );

  const removeMutation = useMutation(convexApi.mutations.blockouts.remove);

  if (!blockouts) {
    return <p className="text-sm text-muted-foreground">Loading blockouts...</p>;
  }

  if (blockouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No blockouts scheduled.</p>;
  }

  const today = new Date();

  async function handleRemove(id: string) {
    await removeMutation({ id });
  }

  return (
    <div className="space-y-2">
      {blockouts.map((blockout) => {
        const isPast = isBefore(parseISO(blockout.date), today);
        return (
          <Card key={blockout._id} className={isPast ? "opacity-50" : ""}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {format(parseISO(blockout.date), "EEE, MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {blockout.startTime} – {blockout.endTime}
                  {blockout.reason && ` · ${blockout.reason}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {isPast && <Badge variant="outline">Past</Badge>}
                {!isPast && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(blockout._id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemove(blockout._id)}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create BlockoutForm dialog component**

Create `apps/admin/components/blockout-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openschedule/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface BlockoutFormProps {
  therapistId: string;
  /** If provided, we're editing an existing blockout */
  editingId?: string | null;
  /** Owner can assign blockouts to any therapist */
  therapists?: Array<{ _id: string; name: string }>;
  isOwner: boolean;
  onClose: () => void;
}

const TIME_OPTIONS = generateTimeOptions();

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

export function BlockoutForm({ therapistId, editingId, therapists, isOwner, onClose }: BlockoutFormProps) {
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const createMutation = useMutation(convexApi.mutations.blockouts.create);
  const updateMutation = useMutation(convexApi.mutations.blockouts.update);

  // Load existing blockout data when editing
  const existingBlockouts = useQuery(
    convexApi.queries.blockouts.listByTherapist,
    { therapistId: selectedTherapistId },
  );

  useEffect(() => {
    if (editingId && existingBlockouts) {
      const existing = existingBlockouts.find((b) => b._id === editingId);
      if (existing) {
        setDate(existing.date);
        setStartTime(existing.startTime);
        setEndTime(existing.endTime);
        setReason(existing.reason ?? "");
        setSelectedTherapistId(existing.therapistId);
      }
    }
  }, [editingId, existingBlockouts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (editingId) {
        await updateMutation({
          id: editingId,
          date,
          startTime,
          endTime,
          reason: reason || undefined,
        });
      } else {
        await createMutation({
          therapistId: selectedTherapistId,
          date,
          startTime,
          endTime,
          reason: reason || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blockout");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Blockout" : "Add Blockout"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Therapist selector (owner only) */}
          {isOwner && therapists && therapists.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="blockout-therapist">Therapist</Label>
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger id="blockout-therapist">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="blockout-date">Date</Label>
            <Input
              id="blockout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="blockout-start">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="blockout-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="blockout-end">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="blockout-end">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <Label htmlFor="blockout-reason">Reason (optional)</Label>
            <Input
              id="blockout-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Training, Personal"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Add Blockout"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Update SchedulePage to include blockouts section**

Replace `apps/admin/components/schedule-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";
import { BlockoutList } from "./blockout-list";
import { BlockoutForm } from "./blockout-form";
import { Button } from "@openschedule/ui/components/button";
import { Separator } from "@openschedule/ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface SchedulePageProps {
  orgSlug: string;
}

export function SchedulePage({ orgSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showBlockoutForm, setShowBlockoutForm] = useState(false);
  const [editingBlockoutId, setEditingBlockoutId] = useState<string | null>(null);
  const [blockoutTherapistFilter, setBlockoutTherapistFilter] = useState<string | null>(null);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const schedules = useQuery(
    convexApi.queries.schedules.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  const isOwner = currentUser?.role === "owner";
  const isTherapist = currentUser?.role === "therapist";

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Therapists only see their own schedules
  const displayedSchedules = isTherapist && currentUser
    ? (schedules ?? []).filter((s) => s.therapistId === currentUser._id)
    : schedules ?? [];

  // Determine which therapist's blockouts to show
  const blockoutTherapistId = isTherapist
    ? currentUser?._id ?? null
    : blockoutTherapistFilter ?? (therapists?.[0]?._id ?? null);

  const editingSchedule = editingScheduleId
    ? schedules?.find((s) => s._id === editingScheduleId) ?? null
    : null;

  const editingTherapistName = editingSchedule
    ? therapists?.find((t) => t._id === editingSchedule.therapistId)?.name ?? "Unknown"
    : "";

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Therapist Schedules</h2>

      {displayedSchedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No schedules configured. Add a schedule to start accepting bookings.
        </p>
      ) : (
        <div className="space-y-3">
          {displayedSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule._id}
              schedule={schedule}
              onEdit={setEditingScheduleId}
            />
          ))}
        </div>
      )}

      {editingSchedule && (
        <ScheduleEditForm
          schedule={{ ...editingSchedule, venueId: venue._id }}
          therapistName={editingTherapistName}
          onClose={() => setEditingScheduleId(null)}
          isOwner={isOwner}
        />
      )}

      <Separator />

      {/* Blockouts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Blockouts</h2>
          <Button size="sm" onClick={() => setShowBlockoutForm(true)}>
            Add Blockout
          </Button>
        </div>

        {/* Therapist filter (owner only, when multiple therapists) */}
        {isOwner && therapists && therapists.length > 1 && (
          <Select
            value={blockoutTherapistFilter ?? therapists[0]?._id ?? ""}
            onValueChange={setBlockoutTherapistFilter}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select therapist" />
            </SelectTrigger>
            <SelectContent>
              {therapists.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {blockoutTherapistId && (
          <BlockoutList
            therapistId={blockoutTherapistId}
            onEdit={(id) => {
              setEditingBlockoutId(id);
              setShowBlockoutForm(true);
            }}
          />
        )}
      </div>

      {/* Blockout form dialog */}
      {showBlockoutForm && blockoutTherapistId && (
        <BlockoutForm
          therapistId={blockoutTherapistId}
          editingId={editingBlockoutId}
          therapists={therapists ?? []}
          isOwner={isOwner}
          onClose={() => {
            setShowBlockoutForm(false);
            setEditingBlockoutId(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/blockout-list.tsx apps/admin/components/blockout-form.tsx apps/admin/components/schedule-page.tsx
git commit -m "feat: add blockout UI (list + form) to Schedule tab"
```

---

### Task 10: Admin — Org Settings Form (Business Info + Notification Toggle + Logo Upload)

**Files:**
- Create: `apps/admin/components/org-settings-form.tsx`

- [ ] **Step 1: Create OrgSettingsForm component**

Create `apps/admin/components/org-settings-form.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Switch } from "@openschedule/ui/components/switch";

interface OrgSettingsFormProps {
  orgId: string;
}

export function OrgSettingsForm({ orgId }: OrgSettingsFormProps) {
  const settings = useQuery(convexApi.queries.settings.getByOrg, { orgId });
  const upsertSettings = useMutation(convexApi.mutations.settings.upsert);
  const generateUploadUrl = useMutation(convexApi.mutations.generateUploadUrl);

  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [logoStorageId, setLogoStorageId] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when settings load
  if (settings !== undefined && !isInitialized) {
    if (settings) {
      setBusinessName(settings.businessName);
      setContactEmail(settings.contactEmail ?? "");
      setContactPhone(settings.contactPhone ?? "");
      setEmailNotificationsEnabled(settings.emailNotificationsEnabled);
      setLogoStorageId(settings.logoStorageId);
    }
    setIsInitialized(true);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await upsertSettings({
        orgId: orgId as any,
        data: {
          businessName,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          logoStorageId: logoStorageId as any,
          emailNotificationsEnabled,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl({});

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();
      setLogoStorageId(storageId);

      // Create local preview
      const previewUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveLogo() {
    setLogoStorageId(null);
    setLogoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Business Info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Business Info</h4>

          <div className="space-y-1">
            <Label htmlFor="org-business-name">Business Name</Label>
            <Input
              id="org-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your Business Name"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="org-contact-email">Contact Email</Label>
            <Input
              id="org-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@yourbusiness.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="org-contact-phone">Contact Phone</Label>
            <Input
              id="org-contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+65 9123 4567"
            />
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo</Label>
            {(logoPreviewUrl || logoStorageId) && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Logo
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo}>
                  Remove
                </Button>
              </div>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={isUploading}
            />
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notifications</h4>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-sm font-medium">
                Email notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, booking confirmations, cancellations, and reschedules are emailed to the therapist and customer.
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotificationsEnabled}
              onCheckedChange={setEmailNotificationsEnabled}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button size="sm" disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/components/org-settings-form.tsx
git commit -m "feat: add OrgSettingsForm component (business info + notifications + logo)"
```

---

### Task 11: Admin — Role-Scope Settings Tab (Wire Team + Org Sections, Hide for Therapist)

**Files:**
- Modify: `apps/admin/components/settings-page.tsx`

- [ ] **Step 1: Update SettingsPage to include Team and Org Settings sections, role-scoped**

Replace `apps/admin/components/settings-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@/lib/convex-api";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";
import { Separator } from "@openschedule/ui/components/separator";
import { TeamSection } from "./team-section";
import { OrgSettingsForm } from "./org-settings-form";

interface SettingsPageProps {
  orgSlug: string;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CreateVenueForm({ orgId }: { orgId: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("17:00");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVenue = useMutation(convexApi.mutations.venues.create);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      await createVenue({
        orgId: orgId as any,
        name,
        slug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your First Venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-venue-name">Venue Name</Label>
            <Input
              id="new-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Main Location"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-venue-slug">Slug</Label>
            <Input
              id="new-venue-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="main-location"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-venue-tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="new-venue-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-venue-capacity">Capacity (beds)</Label>
            <Input
              id="new-venue-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-venue-start">Day Start</Label>
              <Input
                id="new-venue-start"
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-venue-end">Day End</Label>
              <Input
                id="new-venue-end"
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Venue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsPage({ orgSlug }: SettingsPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const [venueName, setVenueName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateVenue = useMutation(convexApi.mutations.venues.update);
  const archiveVenue = useMutation(convexApi.mutations.venues.archive);
  const unarchiveVenue = useMutation(convexApi.mutations.venues.unarchive);

  const isOwner = currentUser?.role === "owner";

  // Initialize form values when venue data arrives
  if (venue && !isInitialized) {
    setVenueName(venue.name);
    setTimezone(venue.timezone);
    setCapacity(venue.capacity);
    setDayStart(venue.dayStart);
    setDayEnd(venue.dayEnd);
    setIsInitialized(true);
  }

  if (org === undefined || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  if (!venue && isOwner) {
    return (
      <div className="space-y-6 p-4">
        <CreateVenueForm orgId={org._id} />
        <Separator />
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {session?.user?.name ?? "Unknown"}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                {session?.user?.email ?? "Unknown"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSaveVenue() {
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
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!venue) return;
    if (!confirm("Archive this venue? All future bookings will be cancelled.")) return;
    await archiveVenue({ id: venue._id });
  }

  async function handleUnarchive() {
    if (!venue) return;
    await unarchiveVenue({ id: venue._id });
  }

  return (
    <div className="space-y-6 p-4">
      {/* Venue settings — owner only */}
      {isOwner && venue && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Venue Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="venue-name">Name</Label>
                <Input
                  id="venue-name"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={venue.slug} disabled />
              </div>

              <div className="space-y-1">
                <Label htmlFor="venue-tz">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="venue-tz">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="venue-capacity">Capacity</Label>
                <Input
                  id="venue-capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="venue-start">Day Start</Label>
                  <Input
                    id="venue-start"
                    type="time"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="venue-end">Day End</Label>
                  <Input
                    id="venue-end"
                    type="time"
                    value={dayEnd}
                    onChange={(e) => setDayEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" disabled={isSaving} onClick={handleSaveVenue}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>

                {venue.status === "active" ? (
                  <Button variant="destructive" size="sm" className="ml-auto" onClick={handleArchive}>
                    Archive Venue
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="ml-auto" onClick={handleUnarchive}>
                    Unarchive Venue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />
        </>
      )}

      {/* Team section — owner only */}
      {isOwner && (
        <>
          <TeamSection />
          <Separator />
        </>
      )}

      {/* Org Settings — owner only */}
      {isOwner && org && (
        <>
          <OrgSettingsForm orgId={org._id} />
          <Separator />
        </>
      )}

      {/* Account — visible to all roles */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {session?.user?.name ?? "Unknown"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {session?.user?.email ?? "Unknown"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/components/settings-page.tsx
git commit -m "feat: role-scope Settings tab (Team + Org sections for owner, Account for all)"
```

---

### Task 12: Final Verification (Typecheck, Tests, Build)

**Files:** None (verification only)

- [ ] **Step 1: Run all Convex tests**

Run: `pnpm vitest run` (from `packages/convex`)
Expected: All tests pass (blockouts, settings, bookings, auth-guards, slots)

- [ ] **Step 2: Run TypeScript type-check on the Convex package**

Run: `pnpm tsc --noEmit` (from `packages/convex`)
Expected: No type errors

- [ ] **Step 3: Run TypeScript type-check on the admin app**

Run: `pnpm tsc --noEmit` (from `apps/admin`)
Expected: No type errors

- [ ] **Step 4: Run the admin app build**

Run: `pnpm build` (from `apps/admin`)
Expected: Build succeeds

- [ ] **Step 5: Fix any issues found**

If any step above fails, fix the issue and re-run verification. Common issues:
- Missing imports (add them)
- Type mismatches in convex-api.ts (align types with actual function signatures)
- Missing component exports (check import paths)

- [ ] **Step 6: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve type errors and test failures from Phase 2"
```

- [ ] **Step 7: Verify clean state**

Run: `git status`
Expected: Working tree clean, all changes committed

---

## Summary of Commits

| # | Message | Scope |
|---|---------|-------|
| 1 | `feat: blockout soft-delete, activate mutation, validation rules` | Backend |
| 2 | `feat: settings CRUD (getByOrg query + upsert mutation)` | Backend |
| 3 | `feat: email action infrastructure (Resend wrapper + booking + invitation)` | Backend |
| 4 | `feat: wire email into booking mutations and invitation callback` | Backend |
| 5 | `feat: add users.getSelf query and generateUploadUrl mutation` | Backend |
| 6 | `feat: update convex-api type map with Phase 2 endpoints` | Admin |
| 7 | `feat: add My/All view toggle with role scoping for therapists` | Admin |
| 8 | `feat: add TeamSection component (member list + invite form)` | Admin |
| 9 | `feat: add blockout UI (list + form) to Schedule tab` | Admin |
| 10 | `feat: add OrgSettingsForm component (business info + notifications + logo)` | Admin |
| 11 | `feat: role-scope Settings tab (Team + Org sections for owner, Account for all)` | Admin |
| 12 | `fix: resolve type errors and test failures from Phase 2` | All (if needed) |
