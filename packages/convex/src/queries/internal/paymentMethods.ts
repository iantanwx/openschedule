import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export const getForVenueInternal = internalQuery({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue || !venue.paymentMethodId) return null;

    const method = await ctx.db.get(venue.paymentMethodId);
    if (!method || method.status !== "active") return null;

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) =>
        q.eq("paymentMethodId", method._id),
      )
      .unique();

    // Resolve QR image URL if present
    let imageUrl: string | null = null;
    if (details?.imageId) {
      const storageId = details.imageId as Id<"_storage">;
      const url = await ctx.storage.getUrl(storageId);
      imageUrl = url ?? null;
    }

    return { ...method, details, imageUrl };
  },
});
