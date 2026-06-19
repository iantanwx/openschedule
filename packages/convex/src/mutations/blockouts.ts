import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";
import { hasRole, Role } from "../lib/roles";

export const create = mutation({
  args: {
    therapistId: v.id("users"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    // Check the acting user is active
    if (user.active === false) {
      throw new Error("Inactive users cannot create blockouts");
    }

    // Validate: startTime must be before endTime
    if (args.startTime >= args.endTime) {
      throw new Error("Start time must be before end time");
    }

    // Validate: cannot create blockout in the past
    const today = new Date().toISOString().split("T")[0] ?? "";
    if (args.date < today) {
      throw new Error("Cannot create a blockout in the past");
    }

    return await ctx.db.insert("blockouts", { ...args, status: "active" });
  },
});

export const update = mutation({
  args: {
    id: v.id("blockouts"),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const { id, ...fields } = args;
    const blockout = await ctx.db.get(id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    // Build patch from defined fields
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Validate time ordering
    const finalStartTime = (patch.startTime ?? blockout.startTime) as string;
    const finalEndTime = (patch.endTime ?? blockout.endTime) as string;
    if (finalStartTime >= finalEndTime) {
      throw new Error("Start time must be before end time");
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    await ctx.db.patch(args.id, { status: "inactive" });
  },
});

export const activate = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    await ctx.db.patch(args.id, { status: "active" });
  },
});
