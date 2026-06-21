import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { timeRangesOverlap } from "../lib/time";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";
import { performCancel } from "../lib/bookings";
import { hasRole, Role } from "../lib/roles";
import { createNotification } from "../lib/notifications";

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
    serviceId: v.optional(v.id("services")),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) {
      throw new Error("Venue not found");
    }

    // Reject booking if target therapist is inactive
    const therapist = await ctx.db.get(args.therapistId);
    if (!therapist || therapist.active === false) {
      throw new Error("Cannot book with an inactive therapist");
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
      if (!authUser || !hasRole(authUser.roles ?? [], Role.Owner)) {
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
      status: "confirmed",
      createdBy: args.createdBy,
      overCapacity: args.overCapacity ?? false,
      cancelToken,
      serviceId: args.serviceId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.actions.sendBookingCreatedEmail.send,
      { bookingId },
    );
    await ctx.scheduler.runAfter(
      0,
      internal.actions.syncCalendarEvent.send,
      { bookingId, action: "create" },
    );

    // In-app notifications
    const customer = await ctx.db.get(args.customerId);
    const service = args.serviceId ? await ctx.db.get(args.serviceId) : null;
    const notifPayload = {
      bookingId,
      customerName: customer?.name ?? "Unknown",
      date: args.date,
      startTime: args.startTime,
      serviceName: service?.name ?? "Appointment",
    };

    // Determine if creator should be excluded (admin-created bookings)
    let excludeUserId: typeof args.therapistId | undefined;
    if (args.createdBy === "owner" || args.createdBy === "therapist") {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const actorUser = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
          .unique();
        if (actorUser) {
          excludeUserId = actorUser._id;
        }
      }
    }

    // Notify the assigned therapist (unless they created it themselves)
    if (args.therapistId !== excludeUserId) {
      await createNotification(ctx, {
        recipientId: args.therapistId,
        type: "booking_created",
        orgId: venue.orgId,
        payload: notifPayload,
      });
    }

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
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "create",
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

    // In-app notifications for cancellation
    const cancelledBooking = await ctx.db.get(args.id);
    if (cancelledBooking) {
      const cancelCustomer = await ctx.db.get(cancelledBooking.customerId);
      const cancelVenue = await ctx.db.get(cancelledBooking.venueId);
      const cancelPayload = {
        bookingId: args.id,
        customerName: cancelCustomer?.name ?? "Unknown",
        date: cancelledBooking.date,
        startTime: cancelledBooking.startTime,
      };
      if (cancelVenue) {
        if (cancelledBooking.therapistId !== user._id) {
          await createNotification(ctx, {
            recipientId: cancelledBooking.therapistId,
            type: "booking_cancelled",
            orgId: cancelVenue.orgId,
            payload: cancelPayload,
          });
        }
      }
    }
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

    // In-app notifications — customer cancelled, notify therapist
    const tokenCancelledBooking = await ctx.db.get(args.id);
    if (tokenCancelledBooking) {
      const tokenCustomer = await ctx.db.get(tokenCancelledBooking.customerId);
      const tokenVenue = await ctx.db.get(tokenCancelledBooking.venueId);
      const tokenPayload = {
        bookingId: args.id,
        customerName: tokenCustomer?.name ?? "Unknown",
        date: tokenCancelledBooking.date,
        startTime: tokenCancelledBooking.startTime,
      };
      if (tokenVenue) {
        await createNotification(ctx, {
          recipientId: tokenCancelledBooking.therapistId,
          type: "booking_cancelled",
          orgId: tokenVenue.orgId,
          payload: tokenPayload,
        });
      }
    }
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
    if (!hasRole(user.roles, Role.Owner) && user._id.toString() !== booking.therapistId.toString()) {
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
    // Delete old calendar event, then create new one with updated times
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "delete",
    });
    await ctx.scheduler.runAfter(0, internal.actions.syncCalendarEvent.send, {
      bookingId: args.id,
      action: "create",
    });

    // In-app notification for reschedule
    const rescheduledBooking = await ctx.db.get(args.id);
    if (rescheduledBooking) {
      const reschCustomer = await ctx.db.get(rescheduledBooking.customerId);
      const reschPayload = {
        bookingId: args.id,
        customerName: reschCustomer?.name ?? "Unknown",
        newDate: args.newDate,
        newStartTime: args.newStartTime,
        rescheduledBy: user.name,
      };
      // Notify the assigned therapist only if actor is different
      if (rescheduledBooking.therapistId !== user._id) {
        await createNotification(ctx, {
          recipientId: rescheduledBooking.therapistId,
          type: "booking_rescheduled",
          orgId: venue.orgId,
          payload: reschPayload,
        });
      }
    }
  },
});
