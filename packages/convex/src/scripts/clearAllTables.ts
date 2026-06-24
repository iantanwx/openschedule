import { internalMutation } from "../_generated/server";
import { components } from "../_generated/api";

/**
 * Clears ALL tables in the database, including betterAuth component tables.
 * Run from the Convex dashboard: Functions → scripts:clearAllTables
 *
 * WARNING: This is destructive and irreversible.
 */
export const clearAllTables = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};

    // --- App tables (accessible via ctx.db) ---
    const appTables = [
      "organizations",
      "venues",
      "schedules",
      "ooo",
      "customers",
      "bookings",
      "settings",
      "integrations",
      "users",
    ] as const;

    for (const table of appTables) {
      let deleted = 0;
      let hasMore = true;
      while (hasMore) {
        const docs = await ctx.db.query(table as any).take(500);
        if (docs.length === 0) {
          hasMore = false;
          break;
        }
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }
      counts[table] = deleted;
    }

    // --- betterAuth component tables (accessed via component adapter) ---
    const authModels = [
      "user",
      "session",
      "account",
      "verification",
      "jwks",
      "organization",
      "member",
      "invitation",
    ] as const;

    for (const model of authModels) {
      let deleted = 0;
      let hasMore = true;
      let cursor: string | null = null;

      while (hasMore) {
        const result: any = await ctx.runMutation(
          // @ts-ignore - components.betterAuth requires codegen from `convex dev`
          components.betterAuth.adapter.deleteMany,
          {
            input: { model },
            paginationOpts: { cursor, numItems: 500 },
          },
        );

        deleted += result?.deletedCount ?? 0;

        if (result?.continueCursor && !result?.isDone) {
          cursor = result.continueCursor;
        } else {
          hasMore = false;
        }
      }
      counts[`auth:${model}`] = deleted;
    }

    console.log("Cleared all tables:", counts);
    return counts;
  },
});
