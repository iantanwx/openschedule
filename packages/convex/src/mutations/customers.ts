import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const getOrCreate = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_orgId_and_email", (q) =>
        q.eq("orgId", args.orgId).eq("email", args.email),
      )
      .unique();

    if (existing) {
      // Update name/phone if provided
      await ctx.db.patch(existing._id, {
        name: args.name,
        ...(args.phone !== undefined ? { phone: args.phone } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("customers", {
      orgId: args.orgId,
      email: args.email,
      name: args.name,
      phone: args.phone,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const customer = await ctx.db.get(id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    if (fields.email && fields.email !== customer.email) {
      const newEmail = fields.email;
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_orgId_and_email", (q) =>
          q.eq("orgId", customer.orgId).eq("email", newEmail),
        )
        .unique();
      if (existing) {
        throw new Error(`Customer with email "${newEmail}" already exists in this org`);
      }
    }
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(id, patch);
  },
});
