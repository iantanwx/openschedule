"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { format, parse } from "date-fns";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import {
  BookingCancelled,
  bookingCancelledPlainText,
  BookingRescheduled,
  bookingRescheduledPlainText,
  generateIcs,
  buildGoogleCalendarUrl,
} from "@opencal/emails";

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

    // Default to enabled when no settings doc exists
    if (settings && !settings.emailNotificationsEnabled) {
      return;
    }

    const organization = await ctx.runQuery(
      internal.queries.internal.organizations.getInternal,
      { id: venue.orgId },
    );
    if (!organization) return;

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

    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const orgName = organization.name;

    // For "confirmed" event, send plain text to therapist only
    // (customer already gets the rich HTML email from sendBookingCreatedEmail)
    if (args.event === "confirmed") {
      const subject = `New booking — ${formattedDate} at ${formatTime(booking.startTime)}`;
      const text = `New booking with ${customer.name} on ${booking.date} from ${booking.startTime} to ${booking.endTime}.\n\nService: ${serviceName}`;
      await sendEmail({ to: [therapist.email], subject, text });
      return;
    }

    if (args.event === "cancelled") {
      const rebookUrl = `${webUrl}/${organization.slug}/${venue.slug}`;

      // Send to customer
      const customerProps = {
        recipientName: customer.name,
        orgName,
        serviceName,
        date: formattedDate,
        time: formattedTime,
        therapistName: therapist.name,
        rebookUrl,
      };

      const customerHtml = await render(BookingCancelled(customerProps));
      const customerText = bookingCancelledPlainText(customerProps);

      await sendEmail({
        to: [customer.email],
        subject: `Booking cancelled — ${formattedDate}`,
        text: customerText,
        html: customerHtml,
      });

      // Send to therapist
      const therapistProps = {
        recipientName: therapist.name,
        orgName,
        serviceName,
        date: formattedDate,
        time: formattedTime,
        therapistName: therapist.name,
        rebookUrl,
      };

      const therapistHtml = await render(BookingCancelled(therapistProps));
      const therapistText = bookingCancelledPlainText(therapistProps);

      await sendEmail({
        to: [therapist.email],
        subject: `Booking cancelled — ${formattedDate}`,
        text: therapistText,
        html: therapistHtml,
      });

      return;
    }

    // args.event === "rescheduled"
    const address = venue.address;
    const coordinates = venue.coordinates;
    const placeId = venue.placeId;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    const timezone = venue.timezone ?? "UTC";

    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = booking.cancelToken
      ? `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`
      : viewUrl;

    // Build Google Calendar URL
    const startDateTime = `${booking.date.replace(/-/g, "")}T${booking.startTime.replace(/:/g, "")}00`;
    const endDateTime = `${booking.date.replace(/-/g, "")}T${booking.endTime.replace(/:/g, "")}00`;

    const calendarUrl = buildGoogleCalendarUrl({
      title: `${serviceName} — ${orgName}`,
      startDate: startDateTime,
      endDate: endDateTime,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Generate .ics file
    const icsContent = generateIcs({
      summary: `${serviceName} — ${orgName}`,
      startDate: `${booking.date}T${booking.startTime}:00`,
      endDate: `${booking.date}T${booking.endTime}:00`,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    const attachments = [
      {
        filename: "booking.ics",
        content: Buffer.from(icsContent).toString("base64"),
        content_type: "text/calendar",
      },
    ];

    // Send to customer
    const customerReschedProps = {
      recipientName: customer.name,
      orgName,
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

    const customerHtml = await render(BookingRescheduled(customerReschedProps));
    const customerText = bookingRescheduledPlainText(customerReschedProps);

    await sendEmail({
      to: [customer.email],
      subject: `Booking rescheduled — ${formattedDate}`,
      text: customerText,
      html: customerHtml,
      attachments,
    });

    // Send to therapist
    const therapistReschedProps = {
      recipientName: therapist.name,
      orgName,
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

    const therapistHtml = await render(
      BookingRescheduled(therapistReschedProps),
    );
    const therapistText = bookingRescheduledPlainText(therapistReschedProps);

    await sendEmail({
      to: [therapist.email],
      subject: `Booking rescheduled — ${formattedDate}`,
      text: therapistText,
      html: therapistHtml,
      attachments,
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
