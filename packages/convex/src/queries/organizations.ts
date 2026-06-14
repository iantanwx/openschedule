import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Organization } from "../types/organizations.queries";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<Organization | null> => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!org) return null;
    return { _id: org._id, _creationTime: org._creationTime, name: org.name, slug: org.slug };
  },
});

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<Organization | null> => {
    const org = await ctx.db.get(args.id);
    if (!org) return null;
    return { _id: org._id, _creationTime: org._creationTime, name: org.name, slug: org.slug };
  },
});
