import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getInternal = internalQuery({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
