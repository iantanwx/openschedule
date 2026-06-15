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
