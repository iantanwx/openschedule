import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const services = await ctx.db
      .query("services")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    return services.filter((s) => s.status === "active");
  },
});

export const listAllByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("services")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
  },
});

export const getBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("services")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
  },
});

export const get = query({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service) return null;
    return {
      _id: service._id,
      name: service.name,
      duration: service.duration,
      price: service.price,
    };
  },
});
