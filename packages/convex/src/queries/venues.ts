import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Venue, VenuePublic } from "../types/venues.queries";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<Venue[]> => {
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    const activeVenues = venues.filter((v) => v.status === "active");
    return activeVenues.map(({ _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status }) => ({
      _id, _creationTime, orgId, name, slug, timezone, capacity, dayStart, dayEnd, status,
    }));
  },
});

export const listByOrgPublic = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<VenuePublic[]> => {
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    const activeVenues = venues.filter((v) => v.status === "active");
    return activeVenues.map(({ _id, name, slug, timezone }) => ({ _id, name, slug, timezone }));
  },
});

export const getBySlug = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args): Promise<VenuePublic | null> => {
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (!venue || venue.status !== "active") return null;
    return { _id: venue._id, name: venue.name, slug: venue.slug, timezone: venue.timezone };
  },
});

export const get = query({
  args: { id: v.id("venues") },
  handler: async (ctx, args): Promise<Venue | null> => {
    const venue = await ctx.db.get(args.id);
    if (!venue) return null;
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status,
    };
  },
});
