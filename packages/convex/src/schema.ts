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

  services: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    duration: v.number(),
    price: v.number(),
    color: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_slug", ["orgId", "slug"]),

  therapistServices: defineTable({
    therapistId: v.id("users"),
    serviceId: v.id("services"),
    orgId: v.id("organizations"),
  })
    .index("by_therapistId", ["therapistId"])
    .index("by_serviceId", ["serviceId"])
    .index("by_orgId", ["orgId"])
    .index("by_therapistId_and_serviceId", ["therapistId", "serviceId"]),

  schedules: defineTable({
    therapistId: v.id("users"),
    venueId: v.id("venues"),
    workingDays: v.array(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    slotDuration: v.optional(v.number()),
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
    cancelToken: v.optional(v.string()),
    serviceId: v.optional(v.id("services")),
    googleCalendarEventId: v.optional(v.string()),
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
    roles: v.optional(v.array(v.union(v.literal("owner"), v.literal("therapist")))),
    active: v.optional(v.boolean()),
    orgId: v.optional(v.id("organizations")),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"])
    .index("by_orgId", ["orgId"]),
});
