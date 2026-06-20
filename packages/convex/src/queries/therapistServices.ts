import { v } from "convex/values";
import { query } from "../_generated/server";

export const listByTherapist = query({
  args: { therapistId: v.id("users") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_therapistId", (q) => q.eq("therapistId", args.therapistId))
      .take(100);

    const services = await Promise.all(
      assignments.map(async (a) => {
        const service = await ctx.db.get(a.serviceId);
        if (!service || service.status !== "active") return null;
        return service;
      }),
    );
    return services.filter((s) => s !== null);
  },
});

export const listTherapistsByService = query({
  args: { serviceId: v.id("services"), venueId: v.id("venues") },
  handler: async (ctx, args) => {
    // Get all therapists assigned to this service
    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .take(100);

    // Filter to those with an active schedule at the venue
    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const activeSchedules = allSchedules.filter((s) => s.status === "active");
    const scheduledTherapistIds = new Set(activeSchedules.map((s) => s.therapistId.toString()));

    const therapists = await Promise.all(
      assignments
        .filter((a) => scheduledTherapistIds.has(a.therapistId.toString()))
        .map(async (a) => {
          const user = await ctx.db.get(a.therapistId);
          if (!user || user.active === false) return null;
          return { _id: user._id, name: user.name };
        }),
    );
    return therapists.filter((t) => t !== null);
  },
});
