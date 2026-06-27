import { v } from "convex/values";
import { query } from "../_generated/server";
import type { OrgSettings } from "../types/settings.queries";

interface DirectoryVenue {
  _id: string;
  name: string;
  slug: string;
  address?: string;
  description?: string;
  coverImageUrl?: string | null;
  org: {
    _id: string;
    name: string;
    slug: string;
    description?: string;
  };
}

export const listPublicDirectory = query({
  args: {},
  handler: async (ctx): Promise<DirectoryVenue[]> => {
    const venues = await ctx.db.query("venues").take(200);
    const activeVenues = venues.filter((venue) => venue.status === "active").slice(0, 50);

    const results: DirectoryVenue[] = [];
    for (const venue of activeVenues) {
      const org = await ctx.db.get(venue.orgId);
      if (!org) continue;

      // Check if org is hidden from directory
      const settingsDoc = await ctx.db
        .query("settings")
        .withIndex("by_scope_and_scopeId", (q) =>
          q.eq("scope", "org").eq("scopeId", venue.orgId),
        )
        .unique();
      if (settingsDoc) {
        const data = settingsDoc.data as OrgSettings;
        if (data.hideFromDirectory) continue;
      }

      let coverImageUrl: string | null = null;
      if (venue.coverImageId) {
        coverImageUrl = await ctx.storage.getUrl(venue.coverImageId);
      }

      results.push({
        _id: venue._id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        description: venue.description,
        coverImageUrl,
        org: {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          description: org.description,
        },
      });
    }
    return results;
  },
});

export const searchDirectory = query({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<DirectoryVenue[]> => {
    const searchTerm = args.query.toLowerCase();
    if (!searchTerm) return [];

    const venues = await ctx.db.query("venues").take(200);
    const activeVenues = venues.filter((venue) => venue.status === "active");

    const results: DirectoryVenue[] = [];
    for (const venue of activeVenues) {
      if (results.length >= 20) break;

      const org = await ctx.db.get(venue.orgId);
      if (!org) continue;

      // Check if org is hidden from directory
      const settingsDoc = await ctx.db
        .query("settings")
        .withIndex("by_scope_and_scopeId", (q) =>
          q.eq("scope", "org").eq("scopeId", venue.orgId),
        )
        .unique();
      if (settingsDoc) {
        const data = settingsDoc.data as OrgSettings;
        if (data.hideFromDirectory) continue;
      }

      const venueNameMatch = venue.name.toLowerCase().includes(searchTerm);
      const orgNameMatch = org.name.toLowerCase().includes(searchTerm);

      if (!venueNameMatch && !orgNameMatch) continue;

      let coverImageUrl: string | null = null;
      if (venue.coverImageId) {
        coverImageUrl = await ctx.storage.getUrl(venue.coverImageId);
      }

      results.push({
        _id: venue._id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        description: venue.description,
        coverImageUrl,
        org: {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          description: org.description,
        },
      });
    }
    return results;
  },
});
