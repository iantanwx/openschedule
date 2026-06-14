# Convex Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Convex backend for OpenSchedule — schema, queries, mutations, and slot computation logic.

**Architecture:** All backend logic lives in `packages/convex/src/`. Schema defines 9 tables with appropriate indexes. Slot availability is computed at query time (not materialized). Convex's transactional mutations prevent double-booking race conditions.

**Tech Stack:** Convex (schema, queries, mutations, actions), convex-test + vitest for testing, TypeScript 5 strict.

---

## File Structure

```
packages/convex/
├── src/
│   ├── schema.ts                    # Full schema (9 tables + indexes)
│   ├── lib/
│   │   ├── slots.ts                 # Slot computation logic (pure function)
│   │   └── time.ts                  # Time utility helpers
│   ├── queries/
│   │   ├── organizations.ts         # Org lookup by slug
│   │   ├── venues.ts                # Venue queries (by org, by slug)
│   │   ├── schedules.ts             # Schedule queries (by therapist, by venue)
│   │   ├── blockouts.ts             # Blockout queries (by therapist)
│   │   ├── bookings.ts              # Booking queries (by venue, by therapist, by customer)
│   │   ├── customers.ts             # Customer lookup (by email+org)
│   │   └── availability.ts          # Computed slot availability (the big one)
│   ├── mutations/
│   │   ├── organizations.ts         # Create/update org
│   │   ├── venues.ts                # Create/update venue
│   │   ├── schedules.ts             # Create/update schedule
│   │   ├── blockouts.ts             # Create/update/delete blockouts
│   │   ├── bookings.ts              # Create/confirm/cancel bookings
│   │   └── customers.ts             # Create/update customers
│   ├── actions/
│   │   └── (empty for now — email/calendar in a future plan)
│   └── tests/
│       ├── schema.test.ts           # Schema validation tests
│       ├── slots.test.ts            # Slot computation unit tests
│       ├── availability.test.ts     # Availability query integration tests
│       └── bookings.test.ts         # Booking mutation integration tests
├── vitest.config.ts                 # Test configuration
├── package.json                     # Updated with dependencies
└── tsconfig.json                    # TypeScript config
```

---

## Task 1: Project Setup — Dependencies and Config

**Files:**
- Modify: `packages/convex/package.json`
- Create: `packages/convex/tsconfig.json`
- Create: `packages/convex/vitest.config.ts`

- [ ] **Step 1: Update package.json with Convex and test dependencies**

```json
{
  "name": "@openschedule/convex",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "convex dev",
    "deploy": "convex deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "convex": "^1.21.0"
  },
  "devDependencies": {
    "@edge-runtime/vm": "^4.0.0",
    "@openschedule/typescript-config": "workspace:*",
    "convex-test": "^0.0.36",
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@openschedule/typescript-config/base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "strict": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ESNext",
    "lib": ["ESNext"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["src/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: Clean install, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/package.json packages/convex/tsconfig.json packages/convex/vitest.config.ts pnpm-lock.yaml
git commit -m "chore: set up convex package with dependencies and test config"
```

---

## Task 2: Schema Definition

**Files:**
- Modify: `packages/convex/src/schema.ts`

- [ ] **Step 1: Write the full schema**

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  venues: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    capacity: v.number(),
    dayStart: v.string(),
    dayEnd: v.string(),
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

  // better-auth managed table — schema defined by better-auth adapter
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("therapist")),
    orgId: v.id("organizations"),
  })
    .index("by_email", ["email"])
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_role", ["orgId", "role"]),
});
```

- [ ] **Step 2: Run typecheck to validate schema**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: No type errors. (Note: `_generated` types may not exist yet until `convex dev` runs. If typecheck fails on imports from `_generated`, that's expected at this stage — proceed.)

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/schema.ts
git commit -m "feat: define convex schema with 9 tables and indexes"
```

---

## Task 3: Time Utility Helpers

**Files:**
- Create: `packages/convex/src/lib/time.ts`

These are pure functions with no Convex dependencies, used by the slot computation logic.

- [ ] **Step 1: Create the time utility module**

```typescript
/**
 * Time utilities for slot computation.
 * All time strings are in "HH:MM" 24-hour format.
 * All dates are in "YYYY-MM-DD" ISO format.
 */

/** Convert "HH:MM" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Convert minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Generate an array of dates from startDate for N days (inclusive of startDate) */
export function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/** Get the day of week (0=Sun, 6=Sat) for a date string */
export function getDayOfWeek(date: string): number {
  return new Date(date + "T00:00:00").getDay();
}

/** Check if two time ranges overlap. Ranges are [start, end) half-open intervals. */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aStartMin = timeToMinutes(aStart);
  const aEndMin = timeToMinutes(aEnd);
  const bStartMin = timeToMinutes(bStart);
  const bEndMin = timeToMinutes(bEnd);
  return aStartMin < bEndMin && bStartMin < aEndMin;
}

/** Get today's date as "YYYY-MM-DD" in a given IANA timezone */
export function todayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/convex/src/lib/time.ts
git commit -m "feat: add time utility helpers for slot computation"
```

---

## Task 4: Slot Computation Logic

**Files:**
- Create: `packages/convex/src/lib/slots.ts`
- Create: `packages/convex/src/tests/slots.test.ts`

This is the core algorithm. It takes a schedule, blockouts, and existing bookings for a date range and computes available time slots.

- [ ] **Step 1: Write the failing test for slot computation**

```typescript
/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { computeAvailableSlots } from "../lib/slots";

describe("computeAvailableSlots", () => {
  const baseSchedule = {
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60,
  };

  test("generates slots for a working day with no conflicts", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"], // Monday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(8); // 09:00-17:00, 60min slots
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result["2025-06-16"]![7]).toEqual({
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  test("returns empty array for non-working days", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-15"], // Sunday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-15"]).toHaveLength(0);
  });

  test("removes slots that overlap with blockouts", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"], // Monday
      blockouts: [{ date: "2025-06-16", startTime: "10:00", endTime: "12:00" }],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    // 09:00-10:00 OK, 10:00-11:00 blocked, 11:00-12:00 blocked, 12:00+ OK
    expect(result["2025-06-16"]).toHaveLength(6);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result["2025-06-16"]![1]).toEqual({
      startTime: "12:00",
      endTime: "13:00",
    });
  });

  test("removes slots that overlap with existing bookings", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "confirmed" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(7);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("ignores cancelled bookings", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "cancelled" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(8);
  });

  test("removes slots when venue is at capacity", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 2,
      allBookingsForVenueByDate: {
        "2025-06-16": [
          { startTime: "09:00", endTime: "10:00" },
          { startTime: "09:00", endTime: "10:00" },
        ],
      },
    });

    // 09:00-10:00 is at capacity (2 bookings, 2 beds), rest are free
    expect(result["2025-06-16"]).toHaveLength(7);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("handles 30-minute slot durations", () => {
    const result = computeAvailableSlots({
      schedule: { ...baseSchedule, slotDuration: 30 },
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(16); // 8 hours * 2 slots/hour
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "09:30",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @openschedule/convex test`
Expected: FAIL — module `../lib/slots` not found.

- [ ] **Step 3: Implement the slot computation**

```typescript
import { timeToMinutes, minutesToTime, getDayOfWeek, timeRangesOverlap } from "./time";

export interface ScheduleInput {
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDuration: number;
}

export interface BlockoutInput {
  date: string;
  startTime: string;
  endTime: string;
}

export interface BookingInput {
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
}

export interface VenueBookingSlot {
  startTime: string;
  endTime: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface ComputeSlotsInput {
  schedule: ScheduleInput;
  dates: string[];
  blockouts: BlockoutInput[];
  bookings: BookingInput[];
  venueCapacity: number;
  /** All active bookings (any therapist) at the venue, grouped by date — for capacity check */
  allBookingsForVenueByDate: Record<string, VenueBookingSlot[]>;
}

/**
 * Compute available slots for a therapist over a date range.
 *
 * Algorithm per date:
 * 1. If not a working day → empty
 * 2. Generate candidate slots from schedule template
 * 3. Remove slots overlapping blockouts
 * 4. Remove slots overlapping active (pending/confirmed) bookings for this therapist
 * 5. Remove slots where venue is at capacity
 */
export function computeAvailableSlots(
  input: ComputeSlotsInput,
): Record<string, TimeSlot[]> {
  const { schedule, dates, blockouts, bookings, venueCapacity, allBookingsForVenueByDate } = input;
  const result: Record<string, TimeSlot[]> = {};

  for (const date of dates) {
    const dayOfWeek = getDayOfWeek(date);

    // Step 1: Not a working day
    if (!schedule.workingDays.includes(dayOfWeek)) {
      result[date] = [];
      continue;
    }

    // Step 2: Generate candidate slots
    const candidates = generateCandidateSlots(
      schedule.startTime,
      schedule.endTime,
      schedule.slotDuration,
    );

    // Step 3: Filter out blockouts for this date
    const dateBlockouts = blockouts.filter((b) => b.date === date);

    // Step 4: Filter out active bookings for this therapist on this date
    const dateBookings = bookings.filter(
      (b) => b.date === date && b.status !== "cancelled",
    );

    // Step 5: Get venue-wide bookings for capacity check
    const venueBookingsForDate = allBookingsForVenueByDate[date] ?? [];

    const available = candidates.filter((slot) => {
      // Check blockout overlap
      for (const blockout of dateBlockouts) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, blockout.startTime, blockout.endTime)) {
          return false;
        }
      }

      // Check therapist booking overlap
      for (const booking of dateBookings) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, booking.startTime, booking.endTime)) {
          return false;
        }
      }

      // Check venue capacity
      const overlappingVenueBookings = venueBookingsForDate.filter((vb) =>
        timeRangesOverlap(slot.startTime, slot.endTime, vb.startTime, vb.endTime),
      );
      if (overlappingVenueBookings.length >= venueCapacity) {
        return false;
      }

      return true;
    });

    result[date] = available;
  }

  return result;
}

function generateCandidateSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  let current = startMin;
  while (current + slotDuration <= endMin) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + slotDuration),
    });
    current += slotDuration;
  }

  return slots;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/convex/src/lib/slots.ts packages/convex/src/tests/slots.test.ts
git commit -m "feat: implement slot computation algorithm with tests"
```

---

## Task 5: Organization Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/organizations.ts`
- Create: `packages/convex/src/mutations/organizations.ts`

- [ ] **Step 1: Write the organization query**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 2: Write the organization mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(`Organization with slug "${args.slug}" already exists`);
    }
    return await ctx.db.insert("organizations", {
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
    const { id, ...fields } = args;
    const org = await ctx.db.get(id);
    if (!org) {
      throw new Error("Organization not found");
    }
    if (fields.slug && fields.slug !== org.slug) {
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", fields.slug!))
        .unique();
      if (existing) {
        throw new Error(`Organization with slug "${fields.slug}" already exists`);
      }
    }
    const patch: Record<string, string> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.slug !== undefined) patch.slug = fields.slug;
    await ctx.db.patch(id, patch);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/organizations.ts packages/convex/src/mutations/organizations.ts
git commit -m "feat: add organization queries and mutations"
```

---

## Task 6: Venue Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/venues.ts`
- Create: `packages/convex/src/mutations/venues.ts`

- [ ] **Step 1: Write venue queries**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
  },
});

export const getBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
  },
});

export const get = query({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 2: Write venue mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";

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
    const existing = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (existing) {
      throw new Error(`Venue with slug "${args.slug}" already exists in this org`);
    }
    return await ctx.db.insert("venues", args);
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
    const { id, ...fields } = args;
    const venue = await ctx.db.get(id);
    if (!venue) {
      throw new Error("Venue not found");
    }
    if (fields.slug && fields.slug !== venue.slug) {
      const existing = await ctx.db
        .query("venues")
        .withIndex("by_orgId_and_slug", (q) =>
          q.eq("orgId", venue.orgId).eq("slug", fields.slug!),
        )
        .unique();
      if (existing) {
        throw new Error(`Venue with slug "${fields.slug}" already exists in this org`);
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/venues.ts packages/convex/src/mutations/venues.ts
git commit -m "feat: add venue queries and mutations"
```

---

## Task 7: Schedule Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/schedules.ts`
- Create: `packages/convex/src/mutations/schedules.ts`

- [ ] **Step 1: Write schedule queries**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getByTherapistAndVenue = query({
  args: { therapistId: v.id("users"), venueId: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
  },
});

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schedules")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(100);
  },
});
```

- [ ] **Step 2: Write schedule mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";

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

    return await ctx.db.insert("schedules", args);
  },
});

export const remove = mutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/schedules.ts packages/convex/src/mutations/schedules.ts
git commit -m "feat: add schedule queries and mutations"
```

---

## Task 8: Blockout Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/blockouts.ts`
- Create: `packages/convex/src/mutations/blockouts.ts`

- [ ] **Step 1: Write blockout queries**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(200);
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    // Use the by_therapistId_and_date index to get blockouts in date range
    return await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(200);
  },
});
```

- [ ] **Step 2: Write blockout mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const create = mutation({
  args: {
    therapistId: v.id("users"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("blockouts", args);
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
    const { id, ...fields } = args;
    const blockout = await ctx.db.get(id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }
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
    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/blockouts.ts packages/convex/src/mutations/blockouts.ts
git commit -m "feat: add blockout queries and mutations"
```

---

## Task 9: Customer Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/customers.ts`
- Create: `packages/convex/src/mutations/customers.ts`

- [ ] **Step 1: Write customer queries**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getByEmail = query({
  args: { orgId: v.id("organizations"), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_orgId_and_email", (q) =>
        q.eq("orgId", args.orgId).eq("email", args.email),
      )
      .unique();
  },
});

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(200);
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

- [ ] **Step 2: Write customer mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const getOrCreate = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_orgId_and_email", (q) =>
        q.eq("orgId", args.orgId).eq("email", args.email),
      )
      .unique();

    if (existing) {
      // Update name/phone if provided
      await ctx.db.patch(existing._id, {
        name: args.name,
        ...(args.phone !== undefined ? { phone: args.phone } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("customers", {
      orgId: args.orgId,
      email: args.email,
      name: args.name,
      phone: args.phone,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const customer = await ctx.db.get(id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    if (fields.email && fields.email !== customer.email) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_orgId_and_email", (q) =>
          q.eq("orgId", customer.orgId).eq("email", fields.email!),
        )
        .unique();
      if (existing) {
        throw new Error(`Customer with email "${fields.email}" already exists in this org`);
      }
    }
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(id, patch);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/customers.ts packages/convex/src/mutations/customers.ts
git commit -m "feat: add customer queries and mutations"
```

---

## Task 10: Booking Queries and Mutations

**Files:**
- Create: `packages/convex/src/queries/bookings.ts`
- Create: `packages/convex/src/mutations/bookings.ts`

- [ ] **Step 1: Write booking queries**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByVenueAndDate = query({
  args: { venueId: v.id("venues"), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).eq("date", args.date),
      )
      .take(200);
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(50);
  },
});

export const listByVenueDateRange = query({
  args: {
    venueId: v.id("venues"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q
          .eq("venueId", args.venueId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
  },
});
```

- [ ] **Step 2: Write booking mutations**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { timeRangesOverlap } from "../lib/time";

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
          timeRangesOverlap(b.startTime, b.endTime, args.startTime, args.endTime),
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
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status !== "pending") {
      throw new Error(`Cannot confirm a booking with status "${booking.status}"`);
    }
    await ctx.db.patch(args.id, { status: "confirmed" });
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
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/queries/bookings.ts packages/convex/src/mutations/bookings.ts
git commit -m "feat: add booking queries and mutations with conflict checks"
```

---

## Task 11: Availability Query (Slot Computation as Convex Query)

**Files:**
- Create: `packages/convex/src/queries/availability.ts`

This is the public-facing query that computes available slots by combining the schedule, blockouts, bookings, and capacity.

- [ ] **Step 1: Write the availability query**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import { computeAvailableSlots } from "../lib/slots";
import { generateDateRange, todayInTimezone } from "../lib/time";

export const getSlots = query({
  args: {
    venueId: v.id("venues"),
    therapistId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }

    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();

    if (!schedule) {
      return {};
    }

    // Compute date range: today → today + horizonDays
    const today = todayInTimezone(venue.timezone);
    const dates = generateDateRange(today, schedule.availabilityHorizonDays);
    const startDate = dates[0]!;
    const endDate = dates[dates.length - 1]!;

    // Fetch blockouts for this therapist in the date range
    const blockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .take(200);

    // Fetch therapist's bookings in the date range
    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .take(500);

    // Fetch all venue bookings for capacity check
    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q
          .eq("venueId", args.venueId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .take(1000);

    // Group venue bookings by date for capacity computation
    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      if (!allBookingsForVenueByDate[booking.date]) {
        allBookingsForVenueByDate[booking.date] = [];
      }
      allBookingsForVenueByDate[booking.date].push({
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }

    return computeAvailableSlots({
      schedule: {
        workingDays: schedule.workingDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotDuration: schedule.slotDuration,
      },
      dates,
      blockouts: blockouts.map((b) => ({
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      bookings: therapistBookings.map((b) => ({
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
      })),
      venueCapacity: venue.capacity,
      allBookingsForVenueByDate,
    });
  },
});

export const getSlotsForAllTherapists = query({
  args: {
    venueId: v.id("venues"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }

    // Get all schedules for this venue
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);

    if (schedules.length === 0) {
      return {};
    }

    // Use the max horizon across all therapists
    const maxHorizon = Math.max(...schedules.map((s) => s.availabilityHorizonDays));
    const today = todayInTimezone(venue.timezone);
    const dates = generateDateRange(today, Math.min(maxHorizon, 31));
    const startDate = dates[0]!;
    const endDate = dates[dates.length - 1]!;

    // Fetch all venue bookings for capacity check (shared across therapists)
    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q
          .eq("venueId", args.venueId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .take(1000);

    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      if (!allBookingsForVenueByDate[booking.date]) {
        allBookingsForVenueByDate[booking.date] = [];
      }
      allBookingsForVenueByDate[booking.date].push({
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }

    // Compute availability per therapist
    const result: Record<string, Record<string, { startTime: string; endTime: string }[]>> = {};

    for (const schedule of schedules) {
      const therapistId = schedule.therapistId;

      const blockouts = await ctx.db
        .query("blockouts")
        .withIndex("by_therapistId_and_date", (q) =>
          q
            .eq("therapistId", therapistId)
            .gte("date", startDate)
            .lte("date", endDate),
        )
        .take(200);

      const therapistBookings = await ctx.db
        .query("bookings")
        .withIndex("by_therapistId_and_date", (q) =>
          q
            .eq("therapistId", therapistId)
            .gte("date", startDate)
            .lte("date", endDate),
        )
        .take(500);

      const scheduleDates = generateDateRange(today, Math.min(schedule.availabilityHorizonDays, 31));

      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          slotDuration: schedule.slotDuration,
        },
        dates: scheduleDates,
        blockouts: blockouts.map((b) => ({
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
        bookings: therapistBookings.map((b) => ({
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
        })),
        venueCapacity: venue.capacity,
        allBookingsForVenueByDate,
      });
    }

    return result;
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/convex/src/queries/availability.ts
git commit -m "feat: add availability query with slot computation"
```

---

## Task 12: Integration Tests for Bookings

**Files:**
- Create: `packages/convex/src/tests/bookings.test.ts`

- [ ] **Step 1: Write booking integration tests**

```typescript
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("booking mutations", () => {
  test("creates a pending booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 3,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    // Insert a user directly (better-auth would do this in production)
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
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

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking).toMatchObject({
      status: "pending",
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      overCapacity: false,
    });
  });

  test("prevents double-booking a therapist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 3,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
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

    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await expect(
      t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-06-16",
        startTime: "09:30",
        endTime: "10:30",
        createdBy: "customer",
      }),
    ).rejects.toThrow("Therapist already has a booking at this time");
  });

  test("prevents booking when venue at capacity", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 1, // Only 1 bed
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const therapist1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "t1@test.com",
        name: "Therapist 1",
        role: "therapist",
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "t2@test.com",
        name: "Therapist 2",
        role: "therapist",
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    // First booking takes the only bed
    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Second booking at same time should fail (venue at capacity)
    await expect(
      t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: therapist2Id,
        customerId,
        date: "2025-06-16",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      }),
    ).rejects.toThrow("Venue is at capacity for this time slot");
  });

  test("allows over-capacity booking with flag", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 1,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const therapist1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "t1@test.com",
        name: "Therapist 1",
        role: "therapist",
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "t2@test.com",
        name: "Therapist 2",
        role: "therapist",
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Owner forces over-capacity
    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist2Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "owner",
      overCapacity: true,
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.overCapacity).toBe(true);
  });

  test("confirms a pending booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 3,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
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

    await t.mutation(api.mutations.bookings.confirm, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("confirmed");
  });

  test("cancels a booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.mutations.organizations.create, {
      name: "Test Org",
      slug: "test-org",
    });
    const venueId = await t.mutation(api.mutations.venues.create, {
      orgId,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "America/New_York",
      capacity: 3,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
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

    await t.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All slot computation tests and booking integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/tests/bookings.test.ts
git commit -m "test: add booking mutation integration tests"
```

---

## Task 13: Generate Convex Types and Final Verification

After all functions are written, the Convex codegen needs to run to generate the `_generated` directory with proper types. This can only happen with a Convex project configured.

**Files:**
- Verify all files compile cleanly

- [ ] **Step 1: Run typecheck**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Either passes clean, or only fails on `_generated` imports (which require `convex dev` to generate). If non-generated type errors appear, fix them.

- [ ] **Step 2: Run all tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: All tests pass.

- [ ] **Step 3: Commit any fixes**

If any fixes were needed:
```bash
git add -A packages/convex/
git commit -m "fix: resolve type errors in convex functions"
```

---

## Task 14: Package Exports and App Dependencies

**Files:**
- Modify: `packages/convex/package.json`
- Modify: `apps/web/package.json`

The `@openschedule/convex` package needs to export its generated types and function references so apps can import them cleanly. Apps need both the `convex` client SDK (for `ConvexProvider`, `useQuery`, etc.) and `@openschedule/convex` (for project-specific types/api).

- [ ] **Step 1: Add exports to packages/convex/package.json**

Update the `exports` field:

```json
{
  "name": "@openschedule/convex",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./api": "./src/_generated/api.ts",
    "./dataModel": "./src/_generated/dataModel.ts",
    "./schema": "./src/schema.ts"
  },
  "scripts": {
    "dev": "convex dev",
    "deploy": "convex deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "convex": "^1.21.0"
  },
  "devDependencies": {
    "@edge-runtime/vm": "^4.0.0",
    "@openschedule/typescript-config": "workspace:*",
    "convex-test": "^0.0.36",
    "typescript": "^5",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Add convex and @openschedule/convex to apps/web**

```json
{
  "dependencies": {
    "@openschedule/convex": "workspace:*",
    "@openschedule/ui": "workspace:*",
    "convex": "^1.21.0",
    "lucide-react": "^1.18.0",
    "next": "16.2.6",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: Clean install, lockfile updated.

- [ ] **Step 4: Commit**

```bash
git add packages/convex/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add convex package exports and app dependencies"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Project setup (deps, tsconfig, vitest) |
| 2 | Schema (9 tables with indexes) |
| 3 | Time utility helpers |
| 4 | Slot computation algorithm + unit tests |
| 5 | Organization CRUD |
| 6 | Venue CRUD |
| 7 | Schedule CRUD |
| 8 | Blockout CRUD |
| 9 | Customer CRUD |
| 10 | Booking CRUD with conflict/capacity checks |
| 11 | Availability query (wires slot computation to Convex) |
| 12 | Booking integration tests |
| 13 | Final type verification |
| 14 | Package exports and app dependencies |
