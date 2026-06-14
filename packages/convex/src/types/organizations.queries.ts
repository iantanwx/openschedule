import { Doc } from "../_generated/dataModel";

/** Full organization returned by admin queries */
export type Organization = Pick<Doc<"organizations">, "_id" | "_creationTime" | "name" | "slug">;
