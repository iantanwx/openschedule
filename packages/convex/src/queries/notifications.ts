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

export const listOrgActivity = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit ?? 50;
    const isOwner = user.roles.includes("owner");

    if (isOwner) {
      // Owner sees all notifications for the org
      // No index on orgId+createdAt, so we query by recipientId and filter
      // Actually we need ALL org notifications — query all recent and filter by orgId
      const allNotifications = await ctx.db
        .query("notifications")
        .order("desc")
        .take(500);
      return allNotifications
        .filter((n) => n.orgId === args.orgId)
        .slice(0, limit);
    }

    // Therapist sees only their own notifications for this org
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_createdAt", (q) =>
        q.eq("recipientId", user._id),
      )
      .order("desc")
      .take(200);
    return notifications
      .filter((n) => n.orgId === args.orgId)
      .slice(0, limit);
  },
});
