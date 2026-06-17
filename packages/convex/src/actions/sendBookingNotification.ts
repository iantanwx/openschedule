"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendEmail } from "./email";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    event: v.union(
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    // Resolve booking data
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} not found, skipping email`,
      );
      return;
    }

    // Skip if already cancelled and event is not "cancelled"
    if (booking.status === "cancelled" && args.event !== "cancelled") {
      return;
    }

    // Check org notification settings
    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );

    // If notifications disabled, skip
    if (!settings || !settings.emailNotificationsEnabled) {
      return;
    }

    // Resolve customer and therapist
    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );

    if (!customer || !therapist) return;

    const recipients = [customer.email, therapist.email].filter(Boolean);

    const subjectMap = {
      confirmed: `Booking confirmed — ${booking.date} at ${booking.startTime}`,
      cancelled: `Booking cancelled — ${booking.date} at ${booking.startTime}`,
      rescheduled: `Booking rescheduled — new time: ${booking.date} at ${booking.startTime}`,
    };

    const bodyMap = {
      confirmed: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been confirmed.`,
      cancelled: `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been cancelled.`,
      rescheduled: `Your booking has been rescheduled to ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name}.`,
    };

    await sendEmail({
      to: recipients,
      subject: subjectMap[args.event],
      text: bodyMap[args.event],
    });
  },
});
