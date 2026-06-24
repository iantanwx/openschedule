import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import { hasRole, Role } from "../lib/roles";

export const create = mutation({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    startTime: v.string(),
    endDate: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    if (
      !hasRole(user.roles, Role.Owner) &&
      user._id.toString() !== args.therapistId.toString()
    ) {
      throw new Error(
        "Therapists can only manage their own out-of-office entries",
      );
    }

    if (user.active === false) {
      throw new Error("Inactive users cannot create out-of-office entries");
    }

    // Validate: endDate >= startDate
    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after start date");
    }

    // Validate: if same day, endTime must be after startTime
    if (args.endDate === args.startDate && args.endTime <= args.startTime) {
      throw new Error("End time must be after start time on the same day");
    }

    // Validate: end must not be entirely in the past
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";
    const nowHours = String(now.getUTCHours()).padStart(2, "0");
    const nowMins = String(now.getUTCMinutes()).padStart(2, "0");
    const nowTime = `${nowHours}:${nowMins}`;

    if (
      args.endDate < todayStr ||
      (args.endDate === todayStr && args.endTime <= nowTime)
    ) {
      throw new Error("Out-of-office end must not be in the past");
    }

    return await ctx.db.insert("ooo", { ...args, status: "active" });
  },
});

export const update = mutation({
  args: {
    id: v.id("ooo"),
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endDate: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (
      !hasRole(user.roles, Role.Owner) &&
      user._id.toString() !== existing.therapistId.toString()
    ) {
      throw new Error(
        "Therapists can only manage their own out-of-office entries",
      );
    }

    // Build patch from defined fields
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Compute final values for validation
    const finalStartDate = (patch.startDate ?? existing.startDate) as string;
    const finalStartTime = (patch.startTime ?? existing.startTime) as string;
    const finalEndDate = (patch.endDate ?? existing.endDate) as string;
    const finalEndTime = (patch.endTime ?? existing.endTime) as string;

    // Validate: endDate >= startDate
    if (finalEndDate < finalStartDate) {
      throw new Error("End date must be on or after start date");
    }

    // Validate: if same day, endTime must be after startTime
    if (finalEndDate === finalStartDate && finalEndTime <= finalStartTime) {
      throw new Error("End time must be after start time on the same day");
    }

    // Validate: end must not be entirely in the past
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";
    const nowHours = String(now.getUTCHours()).padStart(2, "0");
    const nowMins = String(now.getUTCMinutes()).padStart(2, "0");
    const nowTime = `${nowHours}:${nowMins}`;

    if (
      finalEndDate < todayStr ||
      (finalEndDate === todayStr && finalEndTime <= nowTime)
    ) {
      throw new Error("Out-of-office end must not be in the past");
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("ooo") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (
      !hasRole(user.roles, Role.Owner) &&
      user._id.toString() !== existing.therapistId.toString()
    ) {
      throw new Error(
        "Therapists can only manage their own out-of-office entries",
      );
    }

    await ctx.db.patch(args.id, { status: "inactive" });
  },
});

export const activate = mutation({
  args: { id: v.id("ooo") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Out-of-office entry not found");
    }

    if (
      !hasRole(user.roles, Role.Owner) &&
      user._id.toString() !== existing.therapistId.toString()
    ) {
      throw new Error(
        "Therapists can only manage their own out-of-office entries",
      );
    }

    await ctx.db.patch(args.id, { status: "active" });
  },
});
