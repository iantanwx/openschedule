import { v } from "convex/values";
import { query } from "../_generated/server";

/** Public query — used by both admin and customer pages. markedBy intentionally excluded. */
export const getForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .take(10);

    // Return the active (non-voided) payment if one exists
    const active = payments.find((p) => p.status === "paid");
    if (!active) return null;
    return {
      _id: active._id,
      bookingId: active.bookingId,
      paymentMethodId: active.paymentMethodId,
      reference: active.reference,
      markedAt: active.markedAt,
      status: active.status,
    };
  },
});
