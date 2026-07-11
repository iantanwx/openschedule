import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    bookingId: v.id("bookings"),
    paymentMethodId: v.id("paymentMethods"),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    // Verify org access via venue
    const venue = await ctx.db.get(booking.venueId);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    // Verify no existing non-voided payment
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .take(10);
    const activePayment = existing.find((p) => p.status === "paid");
    if (activePayment)
      throw new Error("Booking already has an active payment record");

    const paymentId = await ctx.db.insert("payments", {
      bookingId: args.bookingId,
      paymentMethodId: args.paymentMethodId,
      reference: args.reference,
      markedBy: user._id,
      markedAt: Date.now(),
      status: "paid",
    });

    return paymentId;
  },
});

export const voidPayment = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "voided") throw new Error("Payment already voided");

    // Verify org access
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) throw new Error("Booking not found");
    const venue = await ctx.db.get(booking.venueId);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    await ctx.db.patch(args.id, { status: "voided" });
  },
});
