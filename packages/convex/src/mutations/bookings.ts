import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { timeRangesOverlap } from "../lib/time";

export const create = mutation({
  args: {
    venueId: v.id("venues"),
    therapistId: v.id("users"),
    customerId: v.id("customers"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    createdBy: v.union(
      v.literal("customer"),
      v.literal("therapist"),
      v.literal("owner"),
    ),
    overCapacity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }

    // Check therapist isn't already booked for this slot
    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", args.therapistId).eq("date", args.date),
      )
      .take(100);

    const conflictingBooking = therapistBookings.find(
      (b) =>
        b.status !== "cancelled" &&
        timeRangesOverlap(b.startTime, b.endTime, args.startTime, args.endTime),
    );
    if (conflictingBooking) {
      throw new Error("Therapist already has a booking at this time");
    }

    // Check venue capacity (unless overCapacity is explicitly set)
    if (!args.overCapacity) {
      const venueBookings = await ctx.db
        .query("bookings")
        .withIndex("by_venueId_and_date", (q) =>
          q.eq("venueId", args.venueId).eq("date", args.date),
        )
        .take(200);

      const overlappingCount = venueBookings.filter(
        (b) =>
          b.status !== "cancelled" &&
          timeRangesOverlap(
            b.startTime,
            b.endTime,
            args.startTime,
            args.endTime,
          ),
      ).length;

      if (overlappingCount >= venue.capacity) {
        throw new Error("Venue is at capacity for this time slot");
      }
    }

    return await ctx.db.insert("bookings", {
      venueId: args.venueId,
      therapistId: args.therapistId,
      customerId: args.customerId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      status: "pending",
      createdBy: args.createdBy,
      overCapacity: args.overCapacity ?? false,
    });
  },
});

export const confirm = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status !== "pending") {
      throw new Error(
        `Cannot confirm a booking with status "${booking.status}"`,
      );
    }
    await ctx.db.patch(args.id, { status: "confirmed" });
  },
});

export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled");
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});
