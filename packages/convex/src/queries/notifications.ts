import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit ?? 20;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", user._id),
      )
      .order("desc")
      .take(limit);
    return notifications;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_read", (q) =>
        q.eq("recipientId", user._id).eq("read", false),
      )
      .take(100);
    return unread.length;
  },
});
