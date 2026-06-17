import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";
import type { OrgSettings } from "../types/settings.queries";
import type { Id } from "../_generated/dataModel";

const DEFAULT_SETTINGS: OrgSettings = {
  businessName: "",
  contactEmail: null,
  contactPhone: null,
  logoStorageId: null,
  emailNotificationsEnabled: false,
};

export const upsert = mutation({
  args: {
    orgId: v.id("organizations"),
    data: v.object({
      businessName: v.optional(v.string()),
      contactEmail: v.optional(v.union(v.string(), v.null())),
      contactPhone: v.optional(v.union(v.string(), v.null())),
      logoStorageId: v.optional(v.union(v.string(), v.null())),
      emailNotificationsEnabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_scope_and_scopeId", (q) =>
        q.eq("scope", "org").eq("scopeId", args.orgId),
      )
      .unique();

    if (existing) {
      const currentData = existing.data as OrgSettings;
      const merged: OrgSettings = {
        businessName: args.data.businessName ?? currentData.businessName,
        contactEmail:
          args.data.contactEmail !== undefined
            ? args.data.contactEmail
            : currentData.contactEmail,
        contactPhone:
          args.data.contactPhone !== undefined
            ? args.data.contactPhone
            : currentData.contactPhone,
        logoStorageId:
          args.data.logoStorageId !== undefined
            ? args.data.logoStorageId
            : currentData.logoStorageId,
        emailNotificationsEnabled:
          args.data.emailNotificationsEnabled ??
          currentData.emailNotificationsEnabled,
      };

      // If logo is being replaced, delete old file
      const oldLogoId = currentData.logoStorageId;
      if (
        args.data.logoStorageId !== undefined &&
        oldLogoId &&
        oldLogoId !== args.data.logoStorageId
      ) {
        await ctx.storage.delete(oldLogoId as Id<"_storage">);
      }

      await ctx.db.patch(existing._id, {
        data: merged,
        version: existing.version + 1,
      });
    } else {
      const newData: OrgSettings = {
        businessName:
          args.data.businessName ?? DEFAULT_SETTINGS.businessName,
        contactEmail:
          args.data.contactEmail !== undefined
            ? args.data.contactEmail
            : DEFAULT_SETTINGS.contactEmail,
        contactPhone:
          args.data.contactPhone !== undefined
            ? args.data.contactPhone
            : DEFAULT_SETTINGS.contactPhone,
        logoStorageId:
          args.data.logoStorageId !== undefined
            ? args.data.logoStorageId
            : DEFAULT_SETTINGS.logoStorageId,
        emailNotificationsEnabled:
          args.data.emailNotificationsEnabled ??
          DEFAULT_SETTINGS.emailNotificationsEnabled,
      };

      await ctx.db.insert("settings", {
        scope: "org",
        scopeId: args.orgId,
        version: 1,
        data: newData,
      });
    }
  },
});
