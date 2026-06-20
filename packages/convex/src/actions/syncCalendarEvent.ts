"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  refreshTokenIfNeeded,
  createCalendarEvent,
  deleteCalendarEvent,
} from "./lib/googleCalendar";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    action: v.union(v.literal("create"), v.literal("delete")),
  },
  handler: async (ctx, args) => {
    // 1. Load booking
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(`[CALENDAR] Booking ${args.bookingId} not found, skipping`);
      return;
    }

    // 2. Load therapist's integration
    const integration = await ctx.runQuery(
      internal.queries.internal.integrations.getInternal,
      { userId: booking.therapistId },
    );
    if (!integration || !integration.enabled) {
      return; // No integration or disabled — silently skip
    }

    // 3. Refresh token
    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(ctx, integration);
    } catch (error) {
      console.error(
        `[CALENDAR] Token refresh failed for therapist ${booking.therapistId}:`,
        error,
      );
      // Disable the integration (token likely revoked)
      await ctx.runMutation(internal.mutations.integrations.disable, {
        id: integration._id,
      });
      return;
    }

    // 4. Execute the action
    if (args.action === "create") {
      try {
        // Resolve additional data for event content
        const customer = await ctx.runQuery(
          internal.queries.internal.customers.getInternal,
          { id: booking.customerId },
        );
        const venue = await ctx.runQuery(
          internal.queries.internal.venues.getInternal,
          { id: booking.venueId },
        );

        let serviceName = "";
        if (booking.serviceId) {
          const service = await ctx.runQuery(
            internal.queries.internal.services.getInternal,
            { id: booking.serviceId },
          );
          if (service) {
            serviceName = service.name;
          }
        }

        const customerName = customer?.name ?? "Unknown";
        const summary = serviceName
          ? `Booking: ${customerName} — ${serviceName}`
          : `Booking: ${customerName}`;

        const description = [
          `Customer: ${customerName}`,
          `Email: ${customer?.email ?? "Not provided"}`,
          `Phone: ${customer?.phone ?? "Not provided"}`,
        ].join("\n");

        const timezone = venue?.timezone ?? "UTC";
        const startDateTime = `${booking.date}T${booking.startTime}:00`;
        const endDateTime = `${booking.date}T${booking.endTime}:00`;

        const eventId = await createCalendarEvent(accessToken, {
          summary,
          description,
          start: { dateTime: startDateTime, timeZone: timezone },
          end: { dateTime: endDateTime, timeZone: timezone },
        });

        // Store the event ID on the booking
        await ctx.runMutation(
          internal.mutations.internal.bookings.setGoogleCalendarEventId,
          { bookingId: args.bookingId, eventId },
        );
      } catch (error) {
        console.error(
          `[CALENDAR] Failed to create event for booking ${args.bookingId}:`,
          error,
        );
        // Fire-and-forget: don't throw, booking is unaffected
      }
    } else if (args.action === "delete") {
      const eventId = booking.googleCalendarEventId;
      if (!eventId) {
        return; // No event to delete
      }

      try {
        await deleteCalendarEvent(accessToken, eventId);
        // Clear the event ID
        await ctx.runMutation(
          internal.mutations.internal.bookings.setGoogleCalendarEventId,
          { bookingId: args.bookingId, eventId: null },
        );
      } catch (error) {
        console.error(
          `[CALENDAR] Failed to delete event for booking ${args.bookingId}:`,
          error,
        );
        // Fire-and-forget
      }
    }
  },
});
