import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser, assertOrgAccess } from "../lib/auth";

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertOrgAccess(user, args.orgId);

    const methods = await ctx.db
      .query("paymentMethods")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const results = await Promise.all(
      methods.map(async (method) => {
        const details = await ctx.db
          .query("paymentMethodDetails")
          .withIndex("by_paymentMethodId", (q) =>
            q.eq("paymentMethodId", method._id),
          )
          .unique();
        return { ...method, details };
      }),
    );

    return results;
  },
});

export const get = query({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const method = await ctx.db.get(args.id);
    if (!method) return null;
    assertOrgAccess(user, method.orgId);

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) =>
        q.eq("paymentMethodId", args.id),
      )
      .unique();

    return { ...method, details };
  },
});

export const getForVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue || !venue.paymentMethodId) return null;

    const method = await ctx.db.get(venue.paymentMethodId);
    if (!method || method.status !== "active") return null;

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) =>
        q.eq("paymentMethodId", method._id),
      )
      .unique();

    // Resolve QR image URL if present
    let imageUrl: string | null = null;
    if (details?.imageId) {
      const storageId = details.imageId as Id<"_storage">;
      const url = await ctx.storage.getUrl(storageId);
      imageUrl = url ?? null;
    }

    return { ...method, details, imageUrl };
  },
});

export const listVenuesUsingMethod = query({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const method = await ctx.db.get(args.id);
    if (!method) return [];
    assertOrgAccess(user, method.orgId);

    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", method.orgId))
      .take(100);

    return venues
      .filter((venue) => venue.paymentMethodId?.toString() === args.id.toString())
      .map((venue) => ({ _id: venue._id, name: venue.name }));
  },
});
