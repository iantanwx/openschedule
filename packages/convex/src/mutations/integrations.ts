import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";

export const upsert = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    const config = {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        config,
        enabled: true,
        version: 1,
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      scope: "user",
      scopeId: user._id,
      provider: "google-calendar",
      version: 1,
      config,
      enabled: true,
    });
  },
});

/**
 * Server-side upsert for OAuth callback.
 * Accepts authId (better-auth user ID) — called from trusted Next.js API route
 * after session validation. Resolves the app user by authId.
 */
export const upsertByAuthId = mutation({
  args: {
    authId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    const config = {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        config,
        enabled: true,
        version: 1,
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      scope: "user",
      scopeId: user._id,
      provider: "google-calendar",
      version: 1,
      config,
      enabled: true,
    });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_scopeId_and_provider", (q) =>
        q.eq("scopeId", user._id).eq("provider", "google-calendar"),
      )
      .unique();

    if (!integration) {
      throw new Error("No Google Calendar integration found");
    }

    await ctx.db.patch(integration._id, { enabled: false });
  },
});

export const updateConfig = internalMutation({
  args: {
    id: v.id("integrations"),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { config: args.config });
  },
});

export const disable = internalMutation({
  args: { id: v.id("integrations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { enabled: false });
  },
});
