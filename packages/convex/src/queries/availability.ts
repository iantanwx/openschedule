import { v } from "convex/values";
import { query } from "../_generated/server";
import { computeAvailableSlots } from "../lib/slots";
import { generateDateRange, todayInTimezone, nowTimeInTimezone } from "../lib/time";

export const getSlots = query({
  args: {
    venueId: v.id("venues"),
    therapistId: v.id("users"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");

    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_therapistId_and_venueId", (q) =>
        q.eq("therapistId", args.therapistId).eq("venueId", args.venueId),
      )
      .unique();

    if (!schedule || schedule.status !== "active") {
      return {};
    }

    const today = todayInTimezone(venue.timezone);
    const nowTime = nowTimeInTimezone(venue.timezone);
    const dates = generateDateRange(today, schedule.availabilityHorizonDays);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    if (!startDate || !endDate) return {};

    const allBlockouts = await ctx.db
      .query("blockouts")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", args.therapistId).gte("date", startDate).lte("date", endDate),
      )
      .take(200);
    const blockouts = allBlockouts.filter((b) => b.status === "active");

    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", args.therapistId).gte("date", startDate).lte("date", endDate),
      )
      .take(500);

    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).gte("date", startDate).lte("date", endDate),
      )
      .take(1000);

    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      const dateKey = booking.date;
      let dateBookings = allBookingsForVenueByDate[dateKey];
      if (!dateBookings) {
        dateBookings = [];
        allBookingsForVenueByDate[dateKey] = dateBookings;
      }
      dateBookings.push({ startTime: booking.startTime, endTime: booking.endTime });
    }

    return computeAvailableSlots({
      schedule: {
        workingDays: schedule.workingDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      serviceDuration: service.duration,
      dates,
      blockouts: blockouts.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime })),
      bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
      venueCapacity: venue.capacity,
      allBookingsForVenueByDate,
      todayDate: today,
      nowTime,
    });
  },
});

export const getSlotsForAllTherapists = query({
  args: {
    venueId: v.id("venues"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");

    // Get therapists assigned to this service who have active schedules at this venue
    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .take(100);

    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const activeSchedules = allSchedules.filter((s) => s.status === "active");

    // Only include therapists with both: assigned to service + active schedule at venue
    const assignedTherapistIds = new Set(assignments.map((a) => a.therapistId.toString()));
    const schedules = activeSchedules.filter((s) => assignedTherapistIds.has(s.therapistId.toString()));

    if (schedules.length === 0) return {};

    const maxHorizon = Math.max(...schedules.map((s) => s.availabilityHorizonDays));
    const today = todayInTimezone(venue.timezone);
    const nowTime = nowTimeInTimezone(venue.timezone);
    const dates = generateDateRange(today, Math.min(maxHorizon, 31));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    if (!startDate || !endDate) return {};

    const venueBookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).gte("date", startDate).lte("date", endDate),
      )
      .take(1000);

    const allBookingsForVenueByDate: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const booking of venueBookings) {
      if (booking.status === "cancelled") continue;
      const dateKey = booking.date;
      let dateBookings = allBookingsForVenueByDate[dateKey];
      if (!dateBookings) {
        dateBookings = [];
        allBookingsForVenueByDate[dateKey] = dateBookings;
      }
      dateBookings.push({ startTime: booking.startTime, endTime: booking.endTime });
    }

    const result: Record<string, Record<string, { startTime: string; endTime: string }[]>> = {};

    for (const schedule of schedules) {
      const therapistId = schedule.therapistId;

      const allBlockouts = await ctx.db
        .query("blockouts")
        .withIndex("by_therapistId_and_date", (q) =>
          q.eq("therapistId", therapistId).gte("date", startDate).lte("date", endDate),
        )
        .take(200);
      const blockouts = allBlockouts.filter((b) => b.status === "active");

      const therapistBookings = await ctx.db
        .query("bookings")
        .withIndex("by_therapistId_and_date", (q) =>
          q.eq("therapistId", therapistId).gte("date", startDate).lte("date", endDate),
        )
        .take(500);

      const scheduleDates = generateDateRange(today, Math.min(schedule.availabilityHorizonDays, 31));

      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        serviceDuration: service.duration,
        dates: scheduleDates,
        blockouts: blockouts.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime })),
        bookings: therapistBookings.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
        venueCapacity: venue.capacity,
        allBookingsForVenueByDate,
        todayDate: today,
        nowTime,
      });
    }

    return result;
  },
});
