import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Ooo } from "../types/ooo.queries";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args): Promise<Ooo[]> => {
    const records = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(200);
    return records
      .filter((r) => r.status === "active")
      .map(
        ({
          _id,
          _creationTime,
          therapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason,
          status,
        }) => ({
          _id,
          _creationTime,
          therapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason,
          status,
        }),
      );
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Ooo[]> => {
    // Fetch OoOs where startDate <= end of window (could overlap)
    // Then post-filter: endDate >= start of window (confirms overlap)
    const records = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId_and_startDate", (q) =>
        q.eq("therapistId", args.therapistId).lte("startDate", args.endDate),
      )
      .take(200);
    return records
      .filter((r) => r.endDate >= args.startDate && r.status === "active")
      .map(
        ({
          _id,
          _creationTime,
          therapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason,
          status,
        }) => ({
          _id,
          _creationTime,
          therapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason,
          status,
        }),
      );
  },
});
