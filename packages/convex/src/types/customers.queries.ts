import { Doc } from "../_generated/dataModel";

/** Full customer */
export type Customer = Pick<Doc<"customers">, "_id" | "_creationTime" | "orgId" | "email" | "name" | "phone">;
