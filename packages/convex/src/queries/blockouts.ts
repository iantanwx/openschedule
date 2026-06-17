import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Blockout } from "../types/blockouts.queries";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args): Promise<Blockout[]> => {
    const blockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(200);
    return blockouts
      .filter((b) => b.status === "active")
      .map(({ _id, _creationTime, therapistId, date, startTime, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, date, startTime, endTime, reason, status,
      }));
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Blockout[]> => {
    const blockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(200);
    return blockouts
      .filter((b) => b.status === "active")
      .map(({ _id, _creationTime, therapistId, date, startTime, endTime, reason, status }) => ({
        _id, _creationTime, therapistId, date, startTime, endTime, reason, status,
      }));
  },
});
