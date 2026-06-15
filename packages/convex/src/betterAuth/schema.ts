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
    activeOrganizationId: v.optional(v.string()),
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
  }).index("by_slug", ["slug"]),

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
