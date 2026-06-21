import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";
import { hasRole, Role, type RoleType } from "../lib/roles";

export const setActive = mutation({
  args: {
    userId: v.id("users"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    // Cannot deactivate yourself
    if (user._id.toString() === args.userId.toString()) {
      throw new Error("Cannot deactivate yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Ensure target belongs to same org
    if (targetUser.orgId) {
      assertOrgAccess(user, targetUser.orgId);
    }

    // Cannot deactivate the only owner
    if (!args.active) {
      const targetRoles: RoleType[] = targetUser.roles ?? [];
      if (hasRole(targetRoles, Role.Owner)) {
        const orgUsers = await ctx.db
          .query("users")
          .withIndex("by_orgId", (q) => q.eq("orgId", user.orgId))
          .take(100);
        const activeOwners = orgUsers.filter((u) => {
          const r: RoleType[] = u.roles ?? [];
          return hasRole(r, Role.Owner) && u.active !== false;
        });
        if (activeOwners.length <= 1) {
          throw new Error("Cannot deactivate the only active owner");
        }
      }
    }

    await ctx.db.patch(args.userId, { active: args.active });
  },
});

export const toggleTherapistRole = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    // Toggle "therapist" in the owner's roles
    const currentRoles: RoleType[] = user.roles ?? [];
    const hasTherapist = hasRole(currentRoles, Role.Therapist);

    const newRoles: RoleType[] = hasTherapist
      ? currentRoles.filter((r) => r !== Role.Therapist)
      : [...currentRoles, Role.Therapist];

    await ctx.db.patch(user._id, { roles: newRoles });

    // When adding therapist role, auto-assign all active org services
    if (!hasTherapist) {
      const services = await ctx.db
        .query("services")
        .withIndex("by_orgId", (q) => q.eq("orgId", user.orgId))
        .take(100);
      const activeServices = services.filter((s) => s.status === "active");

      for (const service of activeServices) {
        // Check for existing assignment to avoid duplicates
        const existing = await ctx.db
          .query("therapistServices")
          .withIndex("by_therapistId_and_serviceId", (q) =>
            q.eq("therapistId", user._id).eq("serviceId", service._id),
          )
          .unique();
        if (!existing) {
          await ctx.db.insert("therapistServices", {
            therapistId: user._id,
            serviceId: service._id,
            orgId: user.orgId,
          });
        }
      }
    }
  },
});
