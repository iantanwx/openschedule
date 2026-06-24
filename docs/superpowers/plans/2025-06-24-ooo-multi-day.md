# Multi-Day Out of Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-day `blockouts` table with a multi-day `ooo` (Out of Office) system that spans from start date+time to end date+time, blocking therapist availability across the entire range.

**Architecture:** The OoO system stores contiguous date+time ranges in a single `ooo` table. A pure helper (`lib/ooo.ts`) expands multi-day OoOs into per-day `BlockoutForSlots` entries consumed by the existing `computeAvailableSlots` function. Queries use an index on `(therapistId, startDate)` with post-filtering on `endDate` to find overlapping ranges.

**Tech Stack:** Convex (schema, queries, mutations), Vitest + convex-test for backend tests, React + shadcn/ui for admin frontend, date-fns for date math, pnpm as package manager.

**Deferred:** Booking reassignment to a different therapist when OoO overlaps existing bookings. Admins handle this manually with existing reschedule/cancel tools.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/convex/src/schema.ts` | Replace `blockouts` table with `ooo` |
| Modify | `packages/convex/src/scripts/clearAllTables.ts` | Rename `blockouts` → `ooo` in table list |
| Create | `packages/convex/src/lib/ooo.ts` | `expandOooToDateRanges` helper |
| Create | `packages/convex/src/tests/ooo.test.ts` | Unit tests for expansion helper |
| Create | `packages/convex/src/types/ooo.queries.ts` | OoO query return types |
| Create | `packages/convex/src/queries/ooo.ts` | `listByTherapist`, `listByTherapistAndDateRange` |
| Create | `packages/convex/src/mutations/ooo.ts` | `create`, `update`, `remove`, `activate` |
| Modify | `packages/convex/src/queries/availability.ts` | Replace blockout fetching with OoO + expansion |
| Verify | `packages/convex/src/tests/slots.test.ts` | No changes needed — `blockouts` field on `ComputeSlotsInput` is unchanged |
| Delete | `packages/convex/src/mutations/blockouts.ts` | Old mutations |
| Delete | `packages/convex/src/queries/blockouts.ts` | Old queries |
| Delete | `packages/convex/src/types/blockouts.queries.ts` | Old types |
| Create | `apps/admin/components/ooo-form.tsx` | OoO form dialog |
| Create | `apps/admin/components/ooo-list.tsx` | OoO list cards |
| Modify | `apps/admin/components/schedule-page.tsx` | Use OoO components |
| Modify | `apps/admin/lib/convex-api.ts` | Replace blockouts types with ooo |
| Delete | `apps/admin/components/blockout-form.tsx` | Old form |
| Delete | `apps/admin/components/blockout-list.tsx` | Old list |

---

## Conventions

- **pnpm only** — never use npx. Use `pnpm dlx` for one-off binaries.
- **No `!` non-null assertions** — narrow types with guards/variables/early returns.
- **Semantic commits** — `feat:`, `fix:`, `chore:`, `refactor:`.
- **Typecheck baseline** — `pnpm tsc --noEmit` passes with only 2 pre-existing errors: `auth.ts:15` and `triggers.ts:3`.
- **Tests baseline** — 51/51 passing.
- **Codegen** — after schema changes, run `pnpm dlx convex codegen` from `packages/convex`.
- **Never start dev servers** — the user manages those.

---

### Task 1: Schema — Replace `blockouts` with `ooo` table

**Files:**
- Modify: `packages/convex/src/schema.ts:69-78`
- Modify: `packages/convex/src/scripts/clearAllTables.ts:20`

- [ ] **Step 1: Update schema.ts — replace blockouts table definition**

In `packages/convex/src/schema.ts`, replace lines 69-78:

```typescript
  ooo: defineTable({
    therapistId: v.id("users"),
    startDate: v.string(),
    startTime: v.string(),
    endDate: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_therapistId", ["therapistId"])
    .index("by_therapistId_and_startDate", ["therapistId", "startDate"]),
```

- [ ] **Step 2: Update clearAllTables.ts — rename in table list**

In `packages/convex/src/scripts/clearAllTables.ts`, change `"blockouts"` to `"ooo"` in the `appTables` array (line 20).

```typescript
    const appTables = [
      "organizations",
      "venues",
      "schedules",
      "ooo",
      "customers",
      "bookings",
      "settings",
      "integrations",
      "users",
    ] as const;
```

- [ ] **Step 3: Run codegen**

```bash
cd packages/convex && pnpm dlx convex codegen
```

Expected: codegen succeeds, `_generated/` files updated (gitignored).

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/schema.ts packages/convex/src/scripts/clearAllTables.ts
git commit -m "feat: replace blockouts table with ooo in schema"
```

---

### Task 2: Create `lib/ooo.ts` — expansion helper with TDD

**Files:**
- Create: `packages/convex/src/lib/ooo.ts`
- Create: `packages/convex/src/tests/ooo.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/convex/src/tests/ooo.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { expandOooToDateRanges } from "../lib/ooo";

describe("expandOooToDateRanges", () => {
  test("same-day OoO returns single entry with original times", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-24", endTime: "16:00" },
      ["2025-06-24"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "16:00" },
    ]);
  });

  test("same-day OoO not in dates array returns empty", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-24", endTime: "16:00" },
      ["2025-06-25"],
    );
    expect(result).toEqual([]);
  });

  test("multi-day OoO: first day uses startTime to 23:59", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-24"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
    ]);
  });

  test("multi-day OoO: interior day uses 00:00 to 23:59", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-25"],
    );
    expect(result).toEqual([
      { date: "2025-06-25", startTime: "00:00", endTime: "23:59" },
    ]);
  });

  test("multi-day OoO: last day uses 00:00 to endTime", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-26", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("multi-day OoO: full expansion across all dates", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-24", "2025-06-25", "2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "23:59" },
      { date: "2025-06-26", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("dates outside OoO range are excluded", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-25", endTime: "12:00" },
      ["2025-06-23", "2025-06-24", "2025-06-25", "2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("two-day OoO has no interior days", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "16:00", endDate: "2025-06-25", endTime: "10:00" },
      ["2025-06-24", "2025-06-25"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "16:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "10:00" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/convex && pnpm vitest run src/tests/ooo.test.ts
```

Expected: FAIL — module `../lib/ooo` not found.

- [ ] **Step 3: Write the implementation**

Create `packages/convex/src/lib/ooo.ts`:

```typescript
/**
 * OoO (Out of Office) expansion helper.
 * Expands a multi-day OoO record into per-day BlockoutForSlots entries.
 */

interface OooRecord {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

interface BlockoutForSlots {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Given an OoO record and an array of dates (the availability window),
 * returns per-day blockout entries for each date that falls within the OoO range.
 *
 * Rules:
 * - Same day (startDate === endDate): startTime → endTime
 * - First day: startTime → 23:59
 * - Interior days: 00:00 → 23:59
 * - Last day: 00:00 → endTime
 */
export function expandOooToDateRanges(
  ooo: OooRecord,
  dates: string[],
): BlockoutForSlots[] {
  const results: BlockoutForSlots[] = [];

  for (const date of dates) {
    // Skip dates outside the OoO range
    if (date < ooo.startDate || date > ooo.endDate) {
      continue;
    }

    if (ooo.startDate === ooo.endDate) {
      // Same-day OoO
      results.push({ date, startTime: ooo.startTime, endTime: ooo.endTime });
    } else if (date === ooo.startDate) {
      // First day
      results.push({ date, startTime: ooo.startTime, endTime: "23:59" });
    } else if (date === ooo.endDate) {
      // Last day
      results.push({ date, startTime: "00:00", endTime: ooo.endTime });
    } else {
      // Interior day
      results.push({ date, startTime: "00:00", endTime: "23:59" });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/convex && pnpm vitest run src/tests/ooo.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/lib/ooo.ts packages/convex/src/tests/ooo.test.ts
git commit -m "feat: add expandOooToDateRanges helper with tests"
```

---

### Task 3: Create OoO types, queries, and mutations

**Files:**
- Create: `packages/convex/src/types/ooo.queries.ts`
- Create: `packages/convex/src/queries/ooo.ts`
- Create: `packages/convex/src/mutations/ooo.ts`

- [ ] **Step 1: Create types file**

Create `packages/convex/src/types/ooo.queries.ts`:

```typescript
import type { Doc } from "../_generated/dataModel";

/** Full OoO record for query returns */
export type Ooo = Pick<
  Doc<"ooo">,
  "_id" | "_creationTime" | "therapistId" | "startDate" | "startTime" | "endDate" | "endTime" | "reason" | "status"
>;
```

- [ ] **Step 2: Create queries file**

Create `packages/convex/src/queries/ooo.ts`:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Ooo } from "../types/ooo.queries";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args): Promise<Ooo[]> => {
    const records = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(200);
    return records
      .filter((r) => r.status === "active")
      .map(({ _id, _creationTime, therapistId, startDate, startTime, endDate, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, startDate, startTime, endDate, endTime, reason, status,
      }));
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Ooo[]> => {
    // Fetch OoOs where startDate <= end of window (could overlap)
    // Then post-filter: endDate >= start of window (confirms overlap)
    const records = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId_and_startDate", (q) =>
        q.eq("therapistId", args.therapistId).lte("startDate", args.endDate),
      )
      .take(200);
    return records
      .filter((r) => r.endDate >= args.startDate && r.status === "active")
      .map(({ _id, _creationTime, therapistId, startDate, startTime, endDate, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, startDate, startTime, endDate, endTime, reason, status,
      }));
  },
});
```

- [ ] **Step 3: Create mutations file**

Create `packages/convex/src/mutations/ooo.ts`:

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import { hasRole, Role } from "../lib/roles";

export const create = mutation({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    startTime: v.string(),
    endDate: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own out-of-office entries");
    }

    if (user.active === false) {
      throw new Error("Inactive users cannot create out-of-office entries");
    }

    // Validate: endDate >= startDate
    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after start date");
    }

    // Validate: if same day, endTime must be after startTime
    if (args.endDate === args.startDate && args.endTime <= args.startTime) {
      throw new Error("End time must be after start time on the same day");
    }

    // Validate: end must not be entirely in the past
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";
    const nowHours = String(now.getUTCHours()).padStart(2, "0");
    const nowMins = String(now.getUTCMinutes()).padStart(2, "0");
    const nowTime = `${nowHours}:${nowMins}`;

    if (args.endDate < todayStr || (args.endDate === todayStr && args.endTime <= nowTime)) {
      throw new Error("Out-of-office end must not be in the past");
    }

    return await ctx.db.insert("ooo", { ...args, status: "active" });
  },
});

export const update = mutation({
  args: {
    id: v.id("ooo"),
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endDate: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== existing.therapistId.toString()) {
      throw new Error("Therapists can only manage their own out-of-office entries");
    }

    // Build patch from defined fields
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Compute final values for validation
    const finalStartDate = (patch.startDate ?? existing.startDate) as string;
    const finalStartTime = (patch.startTime ?? existing.startTime) as string;
    const finalEndDate = (patch.endDate ?? existing.endDate) as string;
    const finalEndTime = (patch.endTime ?? existing.endTime) as string;

    // Validate: endDate >= startDate
    if (finalEndDate < finalStartDate) {
      throw new Error("End date must be on or after start date");
    }

    // Validate: if same day, endTime must be after startTime
    if (finalEndDate === finalStartDate && finalEndTime <= finalStartTime) {
      throw new Error("End time must be after start time on the same day");
    }

    // Validate: end must not be entirely in the past
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";
    const nowHours = String(now.getUTCHours()).padStart(2, "0");
    const nowMins = String(now.getUTCMinutes()).padStart(2, "0");
    const nowTime = `${nowHours}:${nowMins}`;

    if (finalEndDate < todayStr || (finalEndDate === todayStr && finalEndTime <= nowTime)) {
      throw new Error("Out-of-office end must not be in the past");
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("ooo") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== existing.therapistId.toString()) {
      throw new Error("Therapists can only manage their own out-of-office entries");
    }

    await ctx.db.patch(args.id, { status: "inactive" });
  },
});

export const activate = mutation({
  args: { id: v.id("ooo") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== existing.therapistId.toString()) {
      throw new Error("Therapists can only manage their own out-of-office entries");
    }

    await ctx.db.patch(args.id, { status: "active" });
  },
});
```

- [ ] **Step 4: Run codegen (schema must already be updated from Task 1)**

```bash
cd packages/convex && pnpm dlx convex codegen
```

Expected: succeeds.

- [ ] **Step 5: Typecheck**

```bash
cd packages/convex && pnpm tsc --noEmit
```

Expected: Only 2 pre-existing errors (auth.ts:15, triggers.ts:3). New files type-clean.

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/types/ooo.queries.ts packages/convex/src/queries/ooo.ts packages/convex/src/mutations/ooo.ts
git commit -m "feat: add OoO queries and mutations"
```

---

### Task 4: Update `queries/availability.ts` — use OoO + expansion

**Files:**
- Modify: `packages/convex/src/queries/availability.ts`

- [ ] **Step 1: Update imports in availability.ts**

Add the import for the expansion helper at the top of `packages/convex/src/queries/availability.ts`:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { computeAvailableSlots } from "../lib/slots";
import { expandOooToDateRanges } from "../lib/ooo";
import { generateDateRange, todayInTimezone, nowTimeInTimezone } from "../lib/time";
```

- [ ] **Step 2: Replace blockout fetching in `getSlots` handler**

Replace lines 38-44 (the `allBlockouts` fetch and filter) with:

```typescript
    // Fetch OoO records overlapping this date window
    const allOooRecords = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId_and_startDate", (q) =>
        q.eq("therapistId", args.therapistId).lte("startDate", endDate),
      )
      .take(200);
    const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

    // Expand multi-day OoOs into per-day blockout entries
    const blockouts = activeOoo.flatMap((r) =>
      expandOooToDateRanges(
        { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
        dates,
      ),
    );
```

- [ ] **Step 3: Update the `computeAvailableSlots` call in `getSlots`**

Replace line 80 (the `blockouts:` mapping line) with the new `blockouts` variable directly:

```typescript
    return computeAvailableSlots({
      schedule: {
        workingDays: schedule.workingDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      serviceDuration: service.duration,
      dates,
      blockouts,
      bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
      venueCapacity: venue.capacity,
      allBookingsForVenueByDate,
      todayDate: today,
      nowTime,
    });
```

- [ ] **Step 4: Replace blockout fetching in `getSlotsForAllTherapists` handler**

Replace lines 153-159 (the per-therapist blockout fetch inside the for loop) with:

```typescript
      const allOooRecords = await ctx.db
        .query("ooo")
        .withIndex("by_therapistId_and_startDate", (q) =>
          q.eq("therapistId", therapistId).lte("startDate", endDate),
        )
        .take(200);
      const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

      const blockouts = activeOoo.flatMap((r) =>
        expandOooToDateRanges(
          { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
          scheduleDates,
        ),
      );
```

- [ ] **Step 5: Update the `computeAvailableSlots` call in the for-loop**

Replace line 178 (the `blockouts:` mapping line inside the loop) with:

```typescript
      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        serviceDuration: service.duration,
        dates: scheduleDates,
        blockouts,
        bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
        venueCapacity: venue.capacity,
        allBookingsForVenueByDate,
        todayDate: today,
        nowTime,
      });
```

- [ ] **Step 6: Verify the full file compiles**

The complete `packages/convex/src/queries/availability.ts` should now be:

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { computeAvailableSlots } from "../lib/slots";
import { expandOooToDateRanges } from "../lib/ooo";
import { generateDateRange, todayInTimezone, nowTimeInTimezone } from "../lib/time";

export const getSlots = query({
  args: {
    venueId: v.id("venues"),
    therapistId: v.id("users"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");

    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();

    if (!schedule || schedule.status !== "active") {
      return {};
    }

    const today = todayInTimezone(venue.timezone);
    const nowTime = nowTimeInTimezone(venue.timezone);
    const dates = generateDateRange(today, schedule.availabilityHorizonDays);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    if (!startDate || !endDate) return {};

    // Fetch OoO records overlapping this date window
    const allOooRecords = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId_and_startDate", (q) =>
        q.eq("therapistId", args.therapistId).lte("startDate", endDate),
      )
      .take(200);
    const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

    // Expand multi-day OoOs into per-day blockout entries
    const blockouts = activeOoo.flatMap((r) =>
      expandOooToDateRanges(
        { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
        dates,
      ),
    );

    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", args.therapistId).gte("date", startDate).lte("date", endDate),
      )
      .take(500);

    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).gte("date", startDate).lte("date", endDate),
      )
      .take(1000);

    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      const dateKey = booking.date;
      let dateBookings = allBookingsForVenueByDate[dateKey];
      if (!dateBookings) {
        dateBookings = [];
        allBookingsForVenueByDate[dateKey] = dateBookings;
      }
      dateBookings.push({ startTime: booking.startTime, endTime: booking.endTime });
    }

    return computeAvailableSlots({
      schedule: {
        workingDays: schedule.workingDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      serviceDuration: service.duration,
      dates,
      blockouts,
      bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
      venueCapacity: venue.capacity,
      allBookingsForVenueByDate,
      todayDate: today,
      nowTime,
    });
  },
});

export const getSlotsForAllTherapists = query({
  args: {
    venueId: v.id("venues"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");

    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .take(100);

    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const activeSchedules = allSchedules.filter((s) => s.status === "active");

    const assignedTherapistIds = new Set(assignments.map((a) => a.therapistId.toString()));
    const schedules = activeSchedules.filter((s) => assignedTherapistIds.has(s.therapistId.toString()));

    if (schedules.length === 0) return {};

    const maxHorizon = Math.max(...schedules.map((s) => s.availabilityHorizonDays));
    const today = todayInTimezone(venue.timezone);
    const nowTime = nowTimeInTimezone(venue.timezone);
    const dates = generateDateRange(today, Math.min(maxHorizon, 31));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    if (!startDate || !endDate) return {};

    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).gte("date", startDate).lte("date", endDate),
      )
      .take(1000);

    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      const dateKey = booking.date;
      let dateBookings = allBookingsForVenueByDate[dateKey];
      if (!dateBookings) {
        dateBookings = [];
        allBookingsForVenueByDate[dateKey] = dateBookings;
      }
      dateBookings.push({ startTime: booking.startTime, endTime: booking.endTime });
    }

    const result: Record<string, Record<string, { startTime: string; endTime: string }[]>> = {};

    for (const schedule of schedules) {
      const therapistId = schedule.therapistId;

      const allOooRecords = await ctx.db
        .query("ooo")
        .withIndex("by_therapistId_and_startDate", (q) =>
          q.eq("therapistId", therapistId).lte("startDate", endDate),
        )
        .take(200);
      const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

      const scheduleDates = generateDateRange(today, Math.min(schedule.availabilityHorizonDays, 31));

      const blockouts = activeOoo.flatMap((r) =>
        expandOooToDateRanges(
          { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
          scheduleDates,
        ),
      );

      const therapistBookings = await ctx.db
        .query("bookings")
        .withIndex("by_therapistId_and_date", (q) =>
          q.eq("therapistId", therapistId).gte("date", startDate).lte("date", endDate),
        )
        .take(500);

      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        serviceDuration: service.duration,
        dates: scheduleDates,
        blockouts,
        bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
        venueCapacity: venue.capacity,
        allBookingsForVenueByDate,
        todayDate: today,
        nowTime,
      });
    }

    return result;
  },
});
```

- [ ] **Step 7: Typecheck**

```bash
cd packages/convex && pnpm tsc --noEmit
```

Expected: Only 2 pre-existing errors.

- [ ] **Step 8: Run all tests (slots tests should still pass — interface unchanged)**

```bash
cd packages/convex && pnpm vitest run
```

Expected: All tests pass (51 existing + 8 new OoO = 59 total).

- [ ] **Step 9: Commit**

```bash
git add packages/convex/src/queries/availability.ts
git commit -m "feat: use OoO table + expansion in availability queries"
```

---

### Task 5: Delete old blockout backend files

**Files:**
- Delete: `packages/convex/src/mutations/blockouts.ts`
- Delete: `packages/convex/src/queries/blockouts.ts`
- Delete: `packages/convex/src/types/blockouts.queries.ts`

- [ ] **Step 1: Delete the files**

```bash
rm packages/convex/src/mutations/blockouts.ts
rm packages/convex/src/queries/blockouts.ts
rm packages/convex/src/types/blockouts.queries.ts
```

- [ ] **Step 2: Run codegen to regenerate the API surface**

```bash
cd packages/convex && pnpm dlx convex codegen
```

- [ ] **Step 3: Typecheck backend**

```bash
cd packages/convex && pnpm tsc --noEmit
```

Expected: Only 2 pre-existing errors. No dangling imports (availability.ts was already updated in Task 4).

- [ ] **Step 4: Run tests**

```bash
cd packages/convex && pnpm vitest run
```

Expected: All pass (59 total).

- [ ] **Step 5: Commit**

```bash
git add -A packages/convex/src/mutations/blockouts.ts packages/convex/src/queries/blockouts.ts packages/convex/src/types/blockouts.queries.ts
git commit -m "chore: delete old blockout backend files"
```

---

### Task 6: Update `slots.test.ts` comments (no code changes needed)

**Files:**
- Modify: `packages/convex/src/tests/slots.test.ts`

The `BlockoutForSlots` interface in `lib/slots.ts` is unchanged — it still accepts `{ date, startTime, endTime }`. The slot tests already use this shape directly (not the table name). No functional changes are needed.

- [ ] **Step 1: Verify tests pass without modification**

```bash
cd packages/convex && pnpm vitest run src/tests/slots.test.ts
```

Expected: All 6 slot tests pass. The test file uses the `blockouts` field name of the `ComputeSlotsInput` interface, which is still named `blockouts` in `lib/slots.ts` (it's the interface field name, not the table name).

- [ ] **Step 2: No commit needed — tests are unchanged**

---

### Task 7: Admin frontend — create `ooo-form.tsx`

**Files:**
- Create: `apps/admin/components/ooo-form.tsx`

- [ ] **Step 1: Create the OoO form component**

Create `apps/admin/components/ooo-form.tsx`:

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

interface OooFormProps {
  therapistId: string;
  editingId?: string | null;
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

export function OooForm({ therapistId, editingId, therapists, isOwner, onClose }: OooFormProps) {
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bookingWarning, setBookingWarning] = useState<string | null>(null);

  const createMutation = useMutation(convexApi.mutations.ooo.create);
  const updateMutation = useMutation(convexApi.mutations.ooo.update);

  // Load existing OoO data when editing
  const existingOoos = useQuery(
    convexApi.queries.ooo.listByTherapist,
    { therapistId: selectedTherapistId },
  );

  // Check for overlapping bookings when dates are set
  const bookingsInRange = useQuery(
    convexApi.queries.bookings.listByTherapistAndDateRange,
    startDate && endDate
      ? { therapistId: selectedTherapistId, startDate, endDate }
      : "skip",
  );

  useEffect(() => {
    if (editingId && existingOoos) {
      const existing = existingOoos.find((o) => o._id === editingId);
      if (existing) {
        setStartDate(existing.startDate);
        setStartTime(existing.startTime);
        setEndDate(existing.endDate);
        setEndTime(existing.endTime);
        setReason(existing.reason ?? "");
        setSelectedTherapistId(existing.therapistId);
      }
    }
  }, [editingId, existingOoos]);

  // Update booking warning when bookings data changes
  useEffect(() => {
    if (bookingsInRange && bookingsInRange.length > 0) {
      const activeBookings = bookingsInRange.filter((b) => b.status !== "cancelled");
      if (activeBookings.length > 0) {
        setBookingWarning(
          `You have ${activeBookings.length} booking${activeBookings.length > 1 ? "s" : ""} during this period that may need rescheduling.`,
        );
      } else {
        setBookingWarning(null);
      }
    } else {
      setBookingWarning(null);
    }
  }, [bookingsInRange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (editingId) {
        await updateMutation({
          id: editingId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason: reason || undefined,
        });
      } else {
        await createMutation({
          therapistId: selectedTherapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason: reason || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save out-of-office");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Out of Office" : "Add Out of Office"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Therapist selector (owner only) */}
          {isOwner && therapists && therapists.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="ooo-therapist">Therapist</Label>
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger id="ooo-therapist">
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

          {/* Start date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ooo-start-date">Start Date</Label>
              <Input
                id="ooo-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Auto-set end date if empty or before start
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ooo-start-time">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="ooo-start-time">
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

          {/* End date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ooo-end-date">End Date</Label>
              <Input
                id="ooo-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ooo-end-time">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="ooo-end-time">
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
            <Label htmlFor="ooo-reason">Reason (optional)</Label>
            <Input
              id="ooo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vacation, Training, Personal"
            />
          </div>

          {/* Booking overlap warning */}
          {bookingWarning && (
            <p className="text-sm text-amber-600">{bookingWarning}</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Add Out of Office"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/components/ooo-form.tsx
git commit -m "feat: add OoO form component"
```

---

### Task 8: Admin frontend — create `ooo-list.tsx`

**Files:**
- Create: `apps/admin/components/ooo-list.tsx`

- [ ] **Step 1: Create the OoO list component**

Create `apps/admin/components/ooo-list.tsx`:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { format, isBefore, parseISO } from "date-fns";

interface OooListProps {
  therapistId: string;
  onEdit: (oooId: string) => void;
}

function formatOooRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const formatTime = (time: string): string => {
    const [h, m] = time.split(":");
    const hour = parseInt(h ?? "0", 10);
    const minute = m ?? "00";
    const suffix = hour >= 12 ? "pm" : "am";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === "00" ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
  };

  if (startDate === endDate) {
    // Same-day: "Tue Jun 24, 2pm – 4pm"
    return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${formatTime(endTime)}`;
  }

  // Multi-day: "Tue Jun 24, 2pm – Thu Jun 26, 12pm"
  return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${format(end, "EEE MMM d")}, ${formatTime(endTime)}`;
}

export function OooList({ therapistId, onEdit }: OooListProps) {
  const ooos = useQuery(
    convexApi.queries.ooo.listByTherapist,
    { therapistId },
  );

  const removeMutation = useMutation(convexApi.mutations.ooo.remove);

  if (!ooos) {
    return <p className="text-sm text-muted-foreground">Loading out-of-office entries...</p>;
  }

  if (ooos.length === 0) {
    return <p className="text-sm text-muted-foreground">No out-of-office entries scheduled.</p>;
  }

  const today = new Date();

  async function handleRemove(id: string) {
    await removeMutation({ id });
  }

  return (
    <div className="space-y-2">
      {ooos.map((ooo) => {
        const isPast = isBefore(parseISO(ooo.endDate), today);
        return (
          <Card key={ooo._id} className={isPast ? "opacity-50" : ""}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {formatOooRange(ooo.startDate, ooo.startTime, ooo.endDate, ooo.endTime)}
                </p>
                {ooo.reason && (
                  <p className="text-xs text-muted-foreground">{ooo.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isPast && <Badge variant="outline">Past</Badge>}
                {!isPast && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(ooo._id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemove(ooo._id)}
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

- [ ] **Step 2: Commit**

```bash
git add apps/admin/components/ooo-list.tsx
git commit -m "feat: add OoO list component"
```

---

### Task 9: Update `schedule-page.tsx` and `convex-api.ts`

**Files:**
- Modify: `apps/admin/components/schedule-page.tsx`
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Update `convex-api.ts` — replace blockouts with ooo**

In `apps/admin/lib/convex-api.ts`, replace the `blockouts` query section (around lines 150-171) with:

```typescript
    ooo: {
      listByTherapist: FunctionReference<"query", "public", { therapistId: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
      listByTherapistAndDateRange: FunctionReference<"query", "public", { therapistId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
    };
```

Replace the `blockouts` mutation section (around lines 375-391) with:

```typescript
    ooo: {
      create: FunctionReference<"mutation", "public", {
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        startDate?: string;
        startTime?: string;
        endDate?: string;
        endTime?: string;
        reason?: string;
      }, void>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
      activate: FunctionReference<"mutation", "public", { id: string }, void>;
    };
```

- [ ] **Step 2: Update `schedule-page.tsx` — replace blockout imports and usage**

Replace the full content of `apps/admin/components/schedule-page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";
import { OooList } from "./ooo-list";
import { OooForm } from "./ooo-form";
import { Button } from "@openschedule/ui/components/button";
import { Separator } from "@openschedule/ui/components/separator";
import { Spinner } from "@openschedule/ui/components/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface SchedulePageProps {
  orgSlug: string;
  venueSlug: string;
}

export function SchedulePage({ orgSlug, venueSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOooForm, setShowOooForm] = useState(false);
  const [editingOooId, setEditingOooId] = useState<string | null>(null);
  const [oooTherapistFilter, setOooTherapistFilter] = useState<string | null>(null);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const schedules = useQuery(
    convexApi.queries.schedules.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  const therapists = useQuery(
    convexApi.queries.users.listTherapistsByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const isTherapist = currentUser?.roles.includes("therapist") ?? false;

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  const displayedSchedules = !isOwner && isTherapist && currentUser
    ? (schedules ?? []).filter((s) => s.therapistId === currentUser._id)
    : schedules ?? [];

  const canAddSchedule =
    !!currentUser &&
    (isOwner ? (therapists?.length ?? 0) > 0 : isTherapist && displayedSchedules.length === 0);

  // Determine which therapist's OoOs to show
  const oooTherapistId = isTherapist
    ? currentUser?._id ?? null
    : oooTherapistFilter ?? (therapists?.[0]?._id ?? null);

  const editingSchedule = editingScheduleId
    ? schedules?.find((s) => s._id === editingScheduleId) ?? null
    : null;

  const editingTherapistName = editingSchedule
    ? therapists?.find((t) => t._id === editingSchedule.therapistId)?.name ?? "Unknown"
    : "";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Therapist Schedules</h2>
        {canAddSchedule && (
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            Add Schedule
          </Button>
        )}
      </div>

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
          schedule={editingSchedule}
          venue={{ _id: venue._id, dayStart: venue.dayStart, dayEnd: venue.dayEnd }}
          therapists={therapists ?? []}
          currentUserId={currentUser?._id ?? ""}
          isOwner={isOwner}
          therapistName={editingTherapistName}
          onClose={() => setEditingScheduleId(null)}
        />
      )}

      {showCreateForm && currentUser && (
        <ScheduleEditForm
          schedule={null}
          venue={{ _id: venue._id, dayStart: venue.dayStart, dayEnd: venue.dayEnd }}
          therapists={therapists ?? []}
          currentUserId={currentUser._id}
          isOwner={isOwner}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <Separator />

      {/* Out of Office section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Out of Office</h2>
          <Button size="sm" onClick={() => setShowOooForm(true)}>
            Add Out of Office
          </Button>
        </div>

        {/* Therapist filter (owner only, when multiple therapists) */}
        {isOwner && therapists && therapists.length > 1 && (
          <Select
            value={oooTherapistFilter ?? therapists[0]?._id ?? ""}
            onValueChange={setOooTherapistFilter}
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

        {oooTherapistId && (
          <OooList
            therapistId={oooTherapistId}
            onEdit={(id) => {
              setEditingOooId(id);
              setShowOooForm(true);
            }}
          />
        )}
      </div>

      {/* OoO form dialog */}
      {showOooForm && oooTherapistId && (
        <OooForm
          therapistId={oooTherapistId}
          editingId={editingOooId}
          therapists={therapists ?? []}
          isOwner={isOwner}
          onClose={() => {
            setShowOooForm(false);
            setEditingOooId(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck admin app**

```bash
cd apps/admin && pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/schedule-page.tsx apps/admin/lib/convex-api.ts
git commit -m "feat: update schedule page and API types for OoO"
```

---

### Task 10: Delete old frontend files

**Files:**
- Delete: `apps/admin/components/blockout-form.tsx`
- Delete: `apps/admin/components/blockout-list.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm apps/admin/components/blockout-form.tsx
rm apps/admin/components/blockout-list.tsx
```

- [ ] **Step 2: Typecheck to confirm no dangling imports**

```bash
cd apps/admin && pnpm tsc --noEmit
```

Expected: clean (schedule-page.tsx already updated to import OoO components).

- [ ] **Step 3: Commit**

```bash
git add -A apps/admin/components/blockout-form.tsx apps/admin/components/blockout-list.tsx
git commit -m "chore: delete old blockout frontend components"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run codegen**

```bash
cd packages/convex && pnpm dlx convex codegen
```

- [ ] **Step 2: Typecheck all packages**

```bash
pnpm tsc --noEmit --project packages/convex/tsconfig.json
pnpm tsc --noEmit --project apps/admin/tsconfig.json
```

Expected: Only the 2 pre-existing errors in the convex package. Admin clean.

- [ ] **Step 3: Run all tests**

```bash
cd packages/convex && pnpm vitest run
```

Expected: 59 tests pass (51 original + 8 new OoO expansion tests).

- [ ] **Step 4: Verify no references to old "blockouts" table remain**

```bash
grep -r "blockouts" packages/convex/src/ --include="*.ts" | grep -v "_generated" | grep -v "node_modules"
grep -r "blockouts" apps/admin/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: no results (or only comments/test variable names using the `blockouts` field on `ComputeSlotsInput` which is the interface field, not a table reference).

- [ ] **Step 5: Final commit (if any grep cleanup needed)**

```bash
git status
# If clean, no commit needed. If minor fixes:
git add -A && git commit -m "chore: remove stray blockout references"
```
