import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.recipientId.toString() !== user._id.toString()) {
      throw new Error("Not your notification");
    }
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_read", (q) =>
        q.eq("recipientId", user._id).eq("read", false),
      )
      .take(100);
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
