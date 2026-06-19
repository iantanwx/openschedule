import { v } from "convex/values";
import { query } from "../_generated/server";
import { hasRole, Role, type RoleType } from "../lib/roles";

export const getPublic = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return { _id: user._id, name: user.name };
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const schedules = allSchedules.filter((s) => s.status === "active");
    const therapistIds = [...new Set(schedules.map((s) => s.therapistId))];
    const users = await Promise.all(
      therapistIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        // Exclude inactive users
        if (user.active === false) return null;
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
  },
});

export const listTherapistsByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(100);
    // Include any user with "therapist" in their roles who is active
    const therapists = allUsers.filter((u) => {
      const roles: RoleType[] = u.roles ?? (u.role ? [u.role as RoleType] : []);
      return hasRole(roles, Role.Therapist) && u.active !== false;
    });
    return therapists.map((t) => ({ _id: t._id, name: t.name }));
  },
});

export const getSelf = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) return null;

    // Derive roles: prefer new field, fall back to legacy
    const roles: RoleType[] = user.roles ?? (user.role ? [user.role as RoleType] : []);

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      roles,
      active: user.active ?? true,
      orgId: user.orgId ?? null,
    };
  },
});
