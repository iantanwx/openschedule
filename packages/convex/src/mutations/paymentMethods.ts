import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    label: v.string(),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.string()),
    identifierType: v.optional(v.string()),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    const paymentMethodId = await ctx.db.insert("paymentMethods", {
      orgId: args.orgId,
      type: args.type,
      label: args.label,
      status: "active",
    });

    await ctx.db.insert("paymentMethodDetails", {
      paymentMethodId,
      type: args.type,
      holderName: args.holderName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      reference: args.reference,
      method: args.method,
      identifierType: args.identifierType,
      identifierValue: args.identifierValue,
      imageId: args.imageId,
      notes: args.notes,
    });

    return paymentMethodId;
  },
});

export const update = mutation({
  args: {
    id: v.id("paymentMethods"),
    label: v.optional(v.string()),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.string()),
    identifierType: v.optional(v.string()),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    if (args.label) {
      await ctx.db.patch(args.id, { label: args.label });
    }

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) => q.eq("paymentMethodId", args.id))
      .unique();
    if (!details) throw new Error("Payment method details not found");

    const { id: _id, label: _label, ...detailFields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detailFields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(details._id, updates);
    }
  },
});

export const deactivate = mutation({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    await ctx.db.patch(args.id, { status: "inactive" });

    // Clear paymentMethodId on any venues referencing this method
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", paymentMethod.orgId))
      .take(100);
    for (const venue of venues) {
      if (venue.paymentMethodId === args.id) {
        await ctx.db.patch(venue._id, { paymentMethodId: undefined });
      }
    }
  },
});

export const reactivate = mutation({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    await ctx.db.patch(args.id, { status: "active" });
  },
});
