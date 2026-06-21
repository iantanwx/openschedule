import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type NotificationType =
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "therapist_joined";

/**
 * Insert a single notification for one recipient.
 */
export async function createNotification(
  ctx: MutationCtx,
  args: {
    recipientId: Id<"users">;
    type: NotificationType;
    orgId: Id<"organizations">;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("notifications", {
    recipientId: args.recipientId,
    type: args.type,
    orgId: args.orgId,
    payload: args.payload,
    read: false,
    createdAt: Date.now(),
  });
}

/**
 * Insert notifications for all owners in an org.
 * Optionally exclude a user (the actor — "don't notify yourself").
 */
export async function createNotificationsForOwners(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    type: NotificationType;
    payload: Record<string, unknown>;
    excludeUserId?: Id<"users">;
  },
): Promise<void> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
    .take(50);
  const owners = users.filter(
    (u) => u.roles?.includes("owner") && u._id !== args.excludeUserId,
  );
  for (const owner of owners) {
    await createNotification(ctx, {
      recipientId: owner._id,
      type: args.type,
      orgId: args.orgId,
      payload: args.payload,
    });
  }
}
