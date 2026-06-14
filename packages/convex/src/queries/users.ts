import { v } from "convex/values";
import { query } from "../_generated/server";

export const getPublic = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return { _id: user._id, name: user.name };
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const therapistIds = [...new Set(schedules.map((s) => s.therapistId))];
    const users = await Promise.all(
      therapistIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
  },
});
