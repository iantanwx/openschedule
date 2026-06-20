import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    duration: v.number(),
    price: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    // Check slug uniqueness within org
    const existing = await ctx.db
      .query("services")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (existing) {
      throw new Error("A service with this slug already exists");
    }

    const serviceId = await ctx.db.insert("services", {
      ...args,
      status: "active",
    });

    // Auto-assign to all active therapists in the org
    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    const therapists = orgUsers.filter(
      (u) => u.roles?.includes("therapist") && u.active !== false,
    );

    for (const therapist of therapists) {
      await ctx.db.insert("therapistServices", {
        therapistId: therapist._id,
        serviceId,
        orgId: args.orgId,
      });
    }

    return serviceId;
  },
});

export const update = mutation({
  args: {
    id: v.id("services"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    duration: v.optional(v.number()),
    price: v.optional(v.number()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    assertOrgAccess(user, service.orgId);

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }

    // If slug changed, check uniqueness
    if (updates.slug && updates.slug !== service.slug) {
      const existing = await ctx.db
        .query("services")
        .withIndex("by_orgId_and_slug", (q) =>
          q.eq("orgId", service.orgId).eq("slug", updates.slug as string),
        )
        .unique();
      if (existing) throw new Error("A service with this slug already exists");
    }

    await ctx.db.patch(id, updates);
  },
});

export const archive = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    assertOrgAccess(user, service.orgId);

    await ctx.db.patch(args.id, { status: "archived" });

    // Remove all therapistServices rows for this service
    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.id))
      .take(200);
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }
  },
});

export const unarchive = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");
    assertOrgAccess(user, service.orgId);

    await ctx.db.patch(args.id, { status: "active" });
  },
});
