import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Booking } from "../types/bookings.queries";

export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args): Promise<Booking | null> => {
    const booking = await ctx.db.get(args.id);
    if (!booking) return null;
    return {
      _id: booking._id,
      _creationTime: booking._creationTime,
      venueId: booking.venueId,
      therapistId: booking.therapistId,
      customerId: booking.customerId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      createdBy: booking.createdBy,
      overCapacity: booking.overCapacity,
    };
  },
});

export const listByVenueAndDate = query({
  args: { venueId: v.id("venues"), date: v.string() },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).eq("date", args.date),
      )
      .take(200);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
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
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }),
    );
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(50);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }),
    );
  },
});

export const listByVenueDateRange = query({
  args: {
    venueId: v.id("venues"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q
          .eq("venueId", args.venueId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
      }),
    );
  },
});
