import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Flip a booking to "cancelled" and schedule the cancelled notification.
 * Single source of truth shared by the auth-guarded admin `cancel` and the
 * token-gated public `cancelWithToken`. Throws if the booking is missing or
 * already cancelled.
 */
export async function performCancel(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
): Promise<void> {
  const booking = await ctx.db.get(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }
  if (booking.status === "cancelled") {
    throw new Error("Booking is already cancelled");
  }
  await ctx.db.patch(bookingId, { status: "cancelled" });
  await ctx.scheduler.runAfter(
    0,
    internal.actions.sendBookingNotification.send,
    { bookingId, event: "cancelled" },
  );
}
