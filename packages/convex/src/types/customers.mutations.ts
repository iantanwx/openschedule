import { Id } from "../_generated/dataModel";

export type GetOrCreateCustomerInput = {
  orgId: Id<"organizations">;
  email: string;
  name: string;
  phone?: string;
};

export type UpdateCustomerInput = {
  name?: string;
  email?: string;
  phone?: string;
};
