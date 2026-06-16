import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { components } from "../_generated/api";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
  // @ts-ignore - components.betterAuth requires codegen from `convex dev`
  components.betterAuth,
  // @ts-ignore - authFunctions generated after first deploy
  {
    local: { schema },
    verbose: false,
    authFunctions: {
      // @ts-ignore - internal.triggers references the exported trigger functions
      onCreate: internal.triggers.onCreate,
      // @ts-ignore
      onUpdate: internal.triggers.onUpdate,
      // @ts-ignore
      onDelete: internal.triggers.onDelete,
    },
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          await ctx.db.insert("users", {
            authId: doc._id,
            email: doc.email,
            name: doc.name ?? "Unknown",
          });
        },
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (user) {
            await ctx.db.patch(user._id, {
              email: doc.email,
              name: doc.name ?? user.name,
            });
          }
        },
        onDelete: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (user) {
            await ctx.db.delete(user._id);
          }
        },
      },
      organization: {
        onCreate: async (ctx, doc) => {
          await ctx.db.insert("organizations", {
            authId: doc._id,
            name: doc.name,
            slug: doc.slug,
          });
        },
        onUpdate: async (ctx, doc) => {
          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (org) {
            await ctx.db.patch(org._id, {
              name: doc.name,
              slug: doc.slug,
            });
          }
        },
        onDelete: async (ctx, doc) => {
          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc._id))
            .unique();
          if (!org) return;
          const venues = await ctx.db
            .query("venues")
            .withIndex("by_orgId", (q) => q.eq("orgId", org._id))
            .take(100);
          for (const venue of venues) {
            if (venue.status === "active") {
              await ctx.db.patch(venue._id, { status: "archived" });
            }
          }
          await ctx.db.delete(org._id);
        },
      },
      member: {
        onCreate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          const org = await ctx.db
            .query("organizations")
            .withIndex("by_authId", (q) => q.eq("authId", doc.organizationId))
            .unique();
          if (!org) return;

          await ctx.db.patch(user._id, {
            orgId: org._id,
            role: doc.role as "owner" | "therapist",
          });
        },
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          await ctx.db.patch(user._id, {
            role: doc.role as "owner" | "therapist",
          });
        },
        onDelete: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          await ctx.db.patch(user._id, {
            orgId: undefined,
            role: undefined,
          });

          const schedules = await ctx.db
            .query("schedules")
            .withIndex("by_therapistId", (q) => q.eq("therapistId", user._id))
            .take(100);
          for (const schedule of schedules) {
            if (schedule.status === "active") {
              await ctx.db.patch(schedule._id, { status: "inactive" });
            }
          }

          const blockouts = await ctx.db
            .query("blockouts")
            .withIndex("by_therapistId", (q) => q.eq("therapistId", user._id))
            .take(200);
          for (const blockout of blockouts) {
            if (blockout.status === "active") {
              await ctx.db.patch(blockout._id, { status: "inactive" });
            }
          }

          const today = new Date().toISOString().split("T")[0] ?? "";
          const bookings = await ctx.db
            .query("bookings")
            .withIndex("by_therapistId_and_date", (q) =>
              q.eq("therapistId", user._id).gte("date", today),
            )
            .take(500);
          for (const booking of bookings) {
            if (booking.status !== "cancelled") {
              await ctx.db.patch(booking._id, { status: "cancelled" });
            }
          }
        },
      },
    },
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>): BetterAuthOptions => {
  return {
    appName: "OpenSchedule",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true },
    plugins: [
      convex({ authConfig }),
      organization({
        allowUserToCreateOrganization: true,
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`Magic link for ${email}: ${url}`);
        },
      }),
    ],
  };
};

export const options: BetterAuthOptions = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>): ReturnType<typeof betterAuth> => {
  return betterAuth(createAuthOptions(ctx));
};
