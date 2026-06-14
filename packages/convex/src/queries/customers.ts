import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Customer } from "../types/customers.queries";

export const getByEmail = query({
  args: { orgId: v.id("organizations"), email: v.string() },
  handler: async (ctx, args): Promise<Customer | null> => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_orgId_and_email", (q) =>
        q.eq("orgId", args.orgId).eq("email", args.email),
      )
      .unique();
    if (!customer) return null;
    return {
      _id: customer._id, _creationTime: customer._creationTime,
      orgId: customer.orgId, email: customer.email, name: customer.name, phone: customer.phone,
    };
  },
});

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<Customer[]> => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(200);
    return customers.map(({ _id, _creationTime, orgId, email, name, phone }) => ({
      _id, _creationTime, orgId, email, name, phone,
    }));
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args): Promise<Customer | null> => {
    const customer = await ctx.db.get(args.id);
    if (!customer) return null;
    return {
      _id: customer._id, _creationTime: customer._creationTime,
      orgId: customer.orgId, email: customer.email, name: customer.name, phone: customer.phone,
    };
  },
});
