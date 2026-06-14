import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Schedule } from "../types/schedules.queries";

export const getByTherapistAndVenue = query({
  args: { therapistId: v.id("users"), venueId: v.id("venues") },
  handler: async (ctx, args): Promise<Schedule | null> => {
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();
    if (!schedule) return null;
    return {
      _id: schedule._id,
      _creationTime: schedule._creationTime,
      therapistId: schedule.therapistId,
      venueId: schedule.venueId,
      workingDays: schedule.workingDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotDuration: schedule.slotDuration,
      availabilityHorizonDays: schedule.availabilityHorizonDays,
    };
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args): Promise<Schedule[]> => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    return schedules.map(
      ({
        _id,
        _creationTime,
        therapistId,
        venueId,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        availabilityHorizonDays,
      }) => ({
        _id,
        _creationTime,
        therapistId,
        venueId,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        availabilityHorizonDays,
      }),
    );
  },
});

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args): Promise<Schedule[]> => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId", (q) =>
        q.eq("therapistId", args.therapistId),
      )
      .take(100);
    return schedules.map(
      ({
        _id,
        _creationTime,
        therapistId,
        venueId,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        availabilityHorizonDays,
      }) => ({
        _id,
        _creationTime,
        therapistId,
        venueId,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        availabilityHorizonDays,
      }),
    );
  },
});
