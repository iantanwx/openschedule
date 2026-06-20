import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const getByCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    if (!integration) return null;

    return {
      _id: integration._id,
      provider: integration.provider,
      enabled: integration.enabled,
      connectedAt: integration._creationTime,
    };
  },
});
