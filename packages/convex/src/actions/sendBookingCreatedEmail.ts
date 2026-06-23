"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { format, parse } from "date-fns";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import {
  BookingCreated,
  bookingCreatedPlainText,
  generateIcs,
  buildGoogleCalendarUrl,
} from "@openschedule/emails";

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

    // Honor the org's email-notification gate (default to enabled)
    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );
    if (settings && !settings.emailNotificationsEnabled) return;

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

    // Resolve service name
    let serviceName = "Appointment";
    if (booking.serviceId) {
      const service = await ctx.runQuery(
        internal.queries.internal.services.getInternal,
        { id: booking.serviceId },
      );
      if (service) {
        serviceName = service.name;
      }
    }

    // Format date and time
    const parsedDate = parse(booking.date, "yyyy-MM-dd", new Date());
    const formattedDate = format(parsedDate, "EEEE, MMMM d, yyyy");
    const formattedTime = `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;

    // Build URLs
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`;

    // Venue location data
    const address = venue.address;
    const coordinates = venue.coordinates;
    const placeId = venue.placeId;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Build Google Calendar URL
    const startDateTime = `${booking.date.replace(/-/g, "")}T${booking.startTime.replace(/:/g, "")}00`;
    const endDateTime = `${booking.date.replace(/-/g, "")}T${booking.endTime.replace(/:/g, "")}00`;
    const timezone = venue.timezone ?? "UTC";

    const calendarUrl = buildGoogleCalendarUrl({
      title: `${serviceName} — ${organization.name}`,
      startDate: startDateTime,
      endDate: endDateTime,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Generate .ics file
    const icsContent = generateIcs({
      summary: `${serviceName} — ${organization.name}`,
      startDate: `${booking.date}T${booking.startTime}:00`,
      endDate: `${booking.date}T${booking.endTime}:00`,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Template props
    const templateProps = {
      customerName: customer.name,
      orgName: organization.name,
      serviceName,
      date: formattedDate,
      time: formattedTime,
      therapistName: therapist.name,
      address,
      coordinates,
      placeId,
      viewUrl,
      cancelUrl,
      calendarUrl,
      googleMapsApiKey,
    };

    // Render HTML
    const html = await render(BookingCreated(templateProps));
    const text = bookingCreatedPlainText(templateProps);

    const subject = `Booking confirmed — ${formattedDate}`;

    await sendEmail({
      to: [customer.email],
      subject,
      text,
      html,
      attachments: [
        {
          filename: "booking.ics",
          content: Buffer.from(icsContent).toString("base64"),
          content_type: "text/calendar",
        },
      ],
    });
  },
});

/**
 * Formats "HH:MM" (24h) to "h:mm AM/PM"
 */
function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  const minutes = minutesStr ?? "00";
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes} ${period}`;
}
