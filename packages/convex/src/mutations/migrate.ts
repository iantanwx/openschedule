import { mutation } from "../_generated/server";
import type { RoleType } from "../lib/roles";

/**
 * One-shot migration: converts legacy `role` field to `roles` array.
 * Idempotent — safe to re-run. Run manually via Convex dashboard or CLI.
 */
export const migrateRolesToArray = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(1000);
    let migrated = 0;

    for (const user of users) {
      // Skip users that already have `roles` set
      if (user.roles && user.roles.length > 0) continue;

      // The legacy `role` field may still exist in DB documents even though
      // it's been removed from the schema definition.
      const legacyRole = (user as unknown as { role?: string }).role;
      if (!legacyRole) continue;

      const roles: RoleType[] = [legacyRole as RoleType];
      await ctx.db.patch(user._id, { roles });
      migrated++;
    }

    return { migrated, total: users.length };
  },
});
