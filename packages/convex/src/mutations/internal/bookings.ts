import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

export const setGoogleCalendarEventId = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    eventId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, string | undefined> = {};
    if (args.eventId === null) {
      update.googleCalendarEventId = undefined;
    } else {
      update.googleCalendarEventId = args.eventId;
    }
    await ctx.db.patch(args.bookingId, update);
  },
});
