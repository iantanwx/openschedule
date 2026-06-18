import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { timeRangesOverlap } from "../lib/time";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";
import { performCancel } from "../lib/bookings";

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

    if (args.overCapacity) {
      // Only owners can override capacity
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required for capacity override");
      }
      const authUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
        .unique();
      if (!authUser || authUser.role !== "owner") {
        throw new Error("Only owners can override venue capacity");
      }
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

    const cancelToken = crypto.randomUUID();
    const bookingId = await ctx.db.insert("bookings", {
      venueId: args.venueId,
      therapistId: args.therapistId,
      customerId: args.customerId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      status: "pending",
      createdBy: args.createdBy,
      overCapacity: args.overCapacity ?? false,
      cancelToken,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.actions.sendBookingCreatedEmail.send,
      { bookingId },
    );
    return bookingId;
  },
});

export const confirm = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify org access via venue
    const venue = await ctx.db.get(booking.venueId);
    if (venue) {
      assertOrgAccess(user, venue.orgId);
    }

    if (booking.status !== "pending") {
      throw new Error(
        `Cannot confirm a booking with status "${booking.status}"`,
      );
    }
    await ctx.db.patch(args.id, { status: "confirmed" });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "confirmed",
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const venue = await ctx.db.get(booking.venueId);
    if (venue) {
      assertOrgAccess(user, venue.orgId);
    }

    await performCancel(ctx, args.id);
  },
});

export const cancelWithToken = mutation({
  args: { id: v.id("bookings"), cancelToken: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (!booking.cancelToken || booking.cancelToken !== args.cancelToken) {
      throw new Error("Invalid or missing cancel token");
    }
    await performCancel(ctx, args.id);
  },
});

export const reschedule = mutation({
  args: {
    id: v.id("bookings"),
    newDate: v.string(),
    newStartTime: v.string(),
    newEndTime: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify org access via venue
    const venue = await ctx.db.get(booking.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }
    assertOrgAccess(user, venue.orgId);

    // Therapists can only reschedule their own bookings
    if (user.role === "therapist" && user._id.toString() !== booking.therapistId.toString()) {
      throw new Error("Therapists can only reschedule their own bookings");
    }

    if (booking.status === "cancelled") {
      throw new Error("Cannot reschedule a cancelled booking");
    }

    // Check therapist isn't double-booked at new time (exclude current booking)
    const therapistBookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q.eq("therapistId", booking.therapistId).eq("date", args.newDate),
      )
      .take(100);

    const conflictingBooking = therapistBookings.find(
      (b) =>
        b._id.toString() !== args.id.toString() &&
        b.status !== "cancelled" &&
        timeRangesOverlap(b.startTime, b.endTime, args.newStartTime, args.newEndTime),
    );
    if (conflictingBooking) {
      throw new Error("Therapist already has a booking at this time");
    }

    // Check venue capacity (unless original was over-capacity)
    if (!booking.overCapacity) {
      const venueBookings = await ctx.db
        .query("bookings")
        .withIndex("by_venueId_and_date", (q) =>
          q.eq("venueId", booking.venueId).eq("date", args.newDate),
        )
        .take(200);

      const overlappingCount = venueBookings.filter(
        (b) =>
          b._id.toString() !== args.id.toString() &&
          b.status !== "cancelled" &&
          timeRangesOverlap(b.startTime, b.endTime, args.newStartTime, args.newEndTime),
      ).length;

      if (overlappingCount >= venue.capacity) {
        throw new Error("Venue is at capacity for this time slot");
      }
    }

    await ctx.db.patch(args.id, {
      date: args.newDate,
      startTime: args.newStartTime,
      endTime: args.newEndTime,
    });
    await ctx.scheduler.runAfter(0, internal.actions.sendBookingNotification.send, {
      bookingId: args.id,
      event: "rescheduled",
    });
  },
});
