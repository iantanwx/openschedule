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
    minAdvanceBookingEnabled: v.optional(v.boolean()),
    minAdvanceBookingMinutes: v.optional(v.number()),
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

    // Validate minAdvanceBookingMinutes if provided
    if (fields.minAdvanceBookingMinutes !== undefined) {
      if (fields.minAdvanceBookingMinutes < 30) {
        throw new Error("Minimum advance booking time must be at least 30 minutes");
      }
      if (fields.minAdvanceBookingMinutes % 30 !== 0) {
        throw new Error("Minimum advance booking time must be divisible by 30 minutes");
      }
    }

    const patch: Record<string, string | number | boolean | { lat: number; lng: number }> = {};
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

export const setPaymentMethod = mutation({
  args: {
    id: v.id("venues"),
    paymentMethodId: v.id("paymentMethods"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    // Verify payment method exists and is active
    const method = await ctx.db.get(args.paymentMethodId);
    if (!method) throw new Error("Payment method not found");
    if (method.status !== "active") throw new Error("Payment method is inactive");
    if (method.orgId.toString() !== venue.orgId.toString()) {
      throw new Error("Payment method belongs to a different organization");
    }

    await ctx.db.patch(args.id, { paymentMethodId: args.paymentMethodId });
  },
});

export const clearPaymentMethod = mutation({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    await ctx.db.patch(args.id, { paymentMethodId: undefined });
  },
});
