import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";

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

    if (user.role === "therapist" && user._id.toString() !== args.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
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

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
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

export const remove = mutation({
  args: { id: v.id("blockouts") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const blockout = await ctx.db.get(args.id);
    if (!blockout) {
      throw new Error("Blockout not found");
    }

    if (user.role === "therapist" && user._id.toString() !== blockout.therapistId.toString()) {
      throw new Error("Therapists can only manage their own blockouts");
    }

    await ctx.db.delete(args.id);
  },
});
