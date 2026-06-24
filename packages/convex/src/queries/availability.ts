import { v } from "convex/values";
import { query } from "../_generated/server";
import { computeAvailableSlots } from "../lib/slots";
import { expandOooToDateRanges } from "../lib/ooo";
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

    // Fetch OoO records overlapping this date window
    const allOooRecords = await ctx.db
      .query("ooo")
      .withIndex("by_therapistId_and_startDate", (q) =>
        q.eq("therapistId", args.therapistId).lte("startDate", endDate),
      )
      .take(200);
    const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

    // Expand multi-day OoOs into per-day blockout entries
    const blockouts = activeOoo.flatMap((r) =>
      expandOooToDateRanges(
        { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
        dates,
      ),
    );

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
      blockouts,
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

    const assignments = await ctx.db
      .query("therapistServices")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .take(100);

    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const activeSchedules = allSchedules.filter((s) => s.status === "active");

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

      const allOooRecords = await ctx.db
        .query("ooo")
        .withIndex("by_therapistId_and_startDate", (q) =>
          q.eq("therapistId", therapistId).lte("startDate", endDate),
        )
        .take(200);
      const activeOoo = allOooRecords.filter((r) => r.endDate >= startDate && r.status === "active");

      const scheduleDates = generateDateRange(today, Math.min(schedule.availabilityHorizonDays, 31));

      const blockouts = activeOoo.flatMap((r) =>
        expandOooToDateRanges(
          { startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime },
          scheduleDates,
        ),
      );

      const therapistBookings = await ctx.db
        .query("bookings")
        .withIndex("by_therapistId_and_date", (q) =>
          q.eq("therapistId", therapistId).gte("date", startDate).lte("date", endDate),
        )
        .take(500);

      result[therapistId] = computeAvailableSlots({
        schedule: {
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        serviceDuration: service.duration,
        dates: scheduleDates,
        blockouts,
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
