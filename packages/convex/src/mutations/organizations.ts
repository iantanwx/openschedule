import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    // Org creation is handled by better-auth org plugin trigger.
    // This mutation is for internal/seed use only.
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(`Organization with slug "${args.slug}" already exists`);
    }
    return await ctx.db.insert("organizations", {
      authId: args.authId,
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const { id, ...fields } = args;
    const org = await ctx.db.get(id);
    if (!org) {
      throw new Error("Organization not found");
    }
    assertOrgAccess(user, org._id);

    if (fields.slug && fields.slug !== org.slug) {
      const newSlug = fields.slug;
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .unique();
      if (existing) {
        throw new Error(`Organization with slug "${newSlug}" already exists`);
      }
    }
    const patch: Record<string, string> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.slug !== undefined) patch.slug = fields.slug;
    if (fields.description !== undefined) patch.description = fields.description;
    await ctx.db.patch(id, patch);
  },
});
