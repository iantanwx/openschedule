import { v } from "convex/values";
import { query } from "../_generated/server";
import type { OrgSettings } from "../types/settings.queries";

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<OrgSettings | null> => {
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();
    if (!doc) return null;
    const data = doc.data as OrgSettings;
    return {
      businessName: data.businessName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      logoStorageId: data.logoStorageId,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
      hideFromDirectory: data.hideFromDirectory ?? false,
    };
  },
});
