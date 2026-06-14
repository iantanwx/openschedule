/** Input for creating an organization (id is auto-generated) */
export type CreateOrganizationInput = {
  name: string;
  slug: string;
};

/** Input for updating an organization (all fields optional) */
export type UpdateOrganizationInput = {
  name?: string;
  slug?: string;
};
