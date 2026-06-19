"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendEmail } from "./email";

export const send = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} not found, skipping created email`,
      );
      return;
    }

    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    // Honor the org's email-notification gate (consistent with sendBookingNotification)
    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );
    if (!settings || !settings.emailNotificationsEnabled) return;

    const organization = await ctx.runQuery(
      internal.queries.internal.organizations.getInternal,
      { id: venue.orgId },
    );
    if (!organization) return;

    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );
    if (!customer || !therapist) return;

    if (!booking.cancelToken) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} has no cancelToken, skipping created email`,
      );
      return;
    }

    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`;

    const subject = `Booking request received — ${booking.date} at ${booking.startTime}`;
    const body = [
      `Hi ${customer.name},`,
      ``,
      `We've received your booking request — the studio will confirm shortly.`,
      ``,
      `Booking details:`,
      `Date: ${booking.date}`,
      `Time: ${booking.startTime} – ${booking.endTime}`,
      `Therapist: ${therapist.name}`,
      ``,
      `View your booking:`,
      viewUrl,
      ``,
      `Need to cancel? Use this link:`,
      cancelUrl,
    ].join("\n");

    await sendEmail({
      to: [customer.email],
      subject,
      text: body,
    });
  },
});
