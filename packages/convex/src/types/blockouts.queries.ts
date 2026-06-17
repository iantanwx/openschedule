import type { Doc } from "../_generated/dataModel";

/** Full blockout */
export type Blockout = Pick<Doc<"blockouts">, "_id" | "_creationTime" | "therapistId" | "date" | "startTime" | "endTime" | "reason" | "status">;
