import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    authId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
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
    address: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    placeId: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    minAdvanceBookingEnabled: v.optional(v.boolean()),
    minAdvanceBookingMinutes: v.optional(v.number()),
    paymentMethodId: v.optional(v.id("paymentMethods")),
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

  paymentMethods: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    label: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }).index("by_orgId", ["orgId"]),

  paymentMethodDetails: defineTable({
    paymentMethodId: v.id("paymentMethods"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.union(v.literal("paynow"))),
    identifierType: v.optional(v.union(v.literal("phone"), v.literal("uen"))),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_paymentMethodId", ["paymentMethodId"]),

  payments: defineTable({
    bookingId: v.id("bookings"),
    paymentMethodId: v.id("paymentMethods"),
    amount: v.optional(v.number()),
    reference: v.optional(v.string()),
    markedBy: v.id("users"),
    markedAt: v.number(),
    status: v.union(v.literal("paid"), v.literal("voided")),
  }).index("by_bookingId", ["bookingId"]),

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
