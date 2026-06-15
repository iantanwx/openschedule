import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "./auth";
import schema from "./schema";

// The adapter API types depend on generated component types that only
// resolve after `convex dev` runs. Suppress portability warnings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapterApi: Record<string, any> = createApi(schema, createAuthOptions);

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = adapterApi;
