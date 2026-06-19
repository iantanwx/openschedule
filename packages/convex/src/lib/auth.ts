import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { hasAnyRole, type RoleType } from "./roles";

export type AuthenticatedUser = Doc<"users"> & {
  roles: RoleType[];
  orgId: NonNullable<Doc<"users">["orgId"]>;
};

/**
 * Gets the authenticated user from context.
 * Throws if unauthenticated or user record not found.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User record not found");
  }

  if (!user.orgId) {
    throw new Error("User has no organization membership");
  }

  const roles: RoleType[] = user.roles ?? [];

  if (roles.length === 0) {
    throw new Error("User has no organization membership");
  }

  return { ...user, roles, orgId: user.orgId } as AuthenticatedUser;
}

/**
 * Asserts the user has one of the specified roles.
 */
export function assertRole(
  user: AuthenticatedUser,
  allowedRoles: RoleType[],
): void {
  if (!hasAnyRole(user.roles, allowedRoles)) {
    throw new Error(
      `Insufficient permissions. Required: ${allowedRoles.join(" or ")}`,
    );
  }
}

/**
 * Asserts the resource belongs to the user's org.
 */
export function assertOrgAccess(
  user: AuthenticatedUser,
  resourceOrgId: Doc<"organizations">["_id"],
): void {
  if (user.orgId.toString() !== resourceOrgId.toString()) {
    throw new Error(
      "Access denied: resource belongs to a different organization",
    );
  }
}
