import { v } from "convex/values";
import { query } from "../_generated/server";

export const getForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .take(10);

    // Return the active (non-voided) payment if one exists
    const active = payments.find((p) => p.status === "paid");
    return active ?? null;
  },
});
