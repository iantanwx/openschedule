import type { Doc } from "../_generated/dataModel";

/** Full OoO record for query returns */
export type Ooo = Pick<
  Doc<"ooo">,
  | "_id"
  | "_creationTime"
  | "therapistId"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "reason"
  | "status"
>;
