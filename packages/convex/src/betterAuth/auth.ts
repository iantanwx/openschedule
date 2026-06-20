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

          // Determine the role to assign
          const newRole = doc.role === "owner" ? "owner" : "therapist";

          // Merge with existing roles (e.g., an owner accepting an invite keeps "owner")
          const existingRoles: string[] = user.roles ?? [];
          const mergedRoles = existingRoles.includes(newRole)
            ? existingRoles
            : [...existingRoles, newRole];

          await ctx.db.patch(user._id, {
            orgId: org._id,
            roles: mergedRoles as ("owner" | "therapist")[],
            active: user.active ?? true,
          });

          // Auto-assign all active org services to the new therapist
          if (mergedRoles.includes("therapist")) {
            const orgServices = await ctx.db
              .query("services")
              .withIndex("by_orgId", (q) => q.eq("orgId", org._id))
              .take(100);
            const activeServices = orgServices.filter((s) => s.status === "active");
            for (const service of activeServices) {
              // Check no duplicate
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
                  orgId: org._id,
                });
              }
            }
          }
        },
        onUpdate: async (ctx, doc) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", doc.userId))
            .unique();
          if (!user) return;

          const newRole = doc.role === "owner" ? "owner" : "therapist";
          const existingRoles: string[] = user.roles ?? [];
          const mergedRoles = existingRoles.includes(newRole)
            ? existingRoles
            : [...existingRoles, newRole];

          await ctx.db.patch(user._id, {
            roles: mergedRoles as ("owner" | "therapist")[],
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
            roles: undefined,
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
    advanced: {
      database: {
        generateId: false, // Convex manages its own _id; prevents org plugin from injecting id
      },
    },
    plugins: [
      convex({ authConfig }),
      organization({
        allowUserToCreateOrganization: true,
        requireEmailVerificationOnInvitation: false, // invitation IDs are unguessable Convex _ids (generateId: false)
        async sendInvitationEmail(data) {
          try {
            const apiKey = process.env.RESEND_API_KEY;
            const from = process.env.FROM_EMAIL ?? "noreply@openschedule.com";
            const appUrl = process.env.APP_URL ?? "http://localhost:3001";
            const acceptUrl = `${appUrl}/invite/${data.id}`;

            const orgName = data.organization?.name ?? "the organization";
            const inviterName = data.inviter?.user?.name ?? "Someone";

            const subject = `You've been invited to join ${orgName}`;
            const text = [
              `Hi,`,
              ``,
              `${inviterName} has invited you to join ${orgName} on OpenSchedule.`,
              ``,
              `Click the link below to accept the invitation:`,
              acceptUrl,
              ``,
              `If you don't have an account yet, you'll be prompted to create one.`,
            ].join("\n");

            if (!apiKey) {
              console.log("[EMAIL DEV MODE] Invitation email:");
              console.log(`  To: ${data.email}`);
              console.log(`  Subject: ${subject}`);
              console.log(`  Body: ${text}`);
              console.log(`  Accept URL: ${acceptUrl}`);
              return;
            }

            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [data.email],
                subject,
                text,
              }),
            });

            if (!response.ok) {
              const errorBody = await response.text();
              console.error(`[EMAIL ERROR] Invitation email failed: ${response.status}: ${errorBody}`);
            }
          } catch (error) {
            console.error("[EMAIL ERROR] Failed to send invitation email:", error);
          }
        },
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
