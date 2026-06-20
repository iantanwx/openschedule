import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", args.userId).eq("provider", "google-calendar"),
      )
      .unique();
  },
});
