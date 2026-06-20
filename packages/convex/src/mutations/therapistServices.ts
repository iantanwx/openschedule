import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const assign = mutation({
  args: {
    therapistId: v.id("users"),
    serviceId: v.id("services"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    // Check no duplicate
    const existing = await ctx.db
      .query("therapistServices")
      .withIndex("by_therapistId_and_serviceId", (q) =>
        q.eq("therapistId", args.therapistId).eq("serviceId", args.serviceId),
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("therapistServices", {
      therapistId: args.therapistId,
      serviceId: args.serviceId,
      orgId: args.orgId,
    });
  },
});

export const remove = mutation({
  args: { therapistId: v.id("users"), serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    // Therapists can only remove their own services
    if (!user.roles.includes("owner") && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own services");
    }

    const assignment = await ctx.db
      .query("therapistServices")
      .withIndex("by_therapistId_and_serviceId", (q) =>
        q.eq("therapistId", args.therapistId).eq("serviceId", args.serviceId),
      )
      .unique();
    if (!assignment) throw new Error("Service assignment not found");

    await ctx.db.delete(assignment._id);
  },
});
