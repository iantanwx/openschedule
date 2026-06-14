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
