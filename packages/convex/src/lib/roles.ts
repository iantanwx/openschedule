export const Role = {
  Owner: "owner",
  Therapist: "therapist",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

/**
 * Check if a roles array includes a specific role.
 * Returns false for undefined/empty arrays.
 */
export function hasRole(roles: RoleType[] | undefined, role: RoleType): boolean {
  return roles?.includes(role) ?? false;
}

/**
 * Check if a roles array includes ANY of the specified roles.
 */
export function hasAnyRole(roles: RoleType[] | undefined, allowedRoles: RoleType[]): boolean {
  return allowedRoles.some((r) => hasRole(roles, r));
}
