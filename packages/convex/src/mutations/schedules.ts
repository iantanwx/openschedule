import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import { hasRole, Role } from "../lib/roles";

export const upsert = mutation({
  args: {
    therapistId: v.id("users"),
    venueId: v.id("venues"),
    workingDays: v.array(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    slotDuration: v.number(),
    availabilityHorizonDays: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    // Therapist can only manage their own schedule
    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }

    // Check target therapist is active
    const targetUser = await ctx.db.get(args.therapistId);
    if (!targetUser || targetUser.active === false) {
      throw new Error("Cannot create schedule for an inactive user");
    }

    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        workingDays: args.workingDays,
        startTime: args.startTime,
        endTime: args.endTime,
        slotDuration: args.slotDuration,
        availabilityHorizonDays: args.availabilityHorizonDays,
      });
      return existing._id;
    }

    return await ctx.db.insert("schedules", { ...args, status: "active" });
  },
});

export const remove = mutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== schedule.therapistId.toString()) {
      throw new Error("Therapists can only manage their own schedule");
    }

    await ctx.db.delete(args.id);
  },
});
