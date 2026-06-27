import { v } from "convex/values";
import { query } from "../_generated/server";

async function getOptionalUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", identity.subject))
    .unique();
  if (!user || !user.orgId || !user.roles?.length) return null;
  return user;
}

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
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
    const user = await getOptionalUser(ctx);
    if (!user) return 0;
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
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const limit = args.limit ?? 50;
    const isOwner = user.roles.includes("owner");

    if (isOwner) {
      const allNotifications = await ctx.db
        .query("notifications")
        .order("desc")
        .take(500);
      return allNotifications
        .filter((n) => n.orgId === args.orgId)
        .slice(0, limit);
    }

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
