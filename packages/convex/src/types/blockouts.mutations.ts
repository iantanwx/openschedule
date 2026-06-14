import { Id } from "../_generated/dataModel";

export type CreateBlockoutInput = {
  therapistId: Id<"users">;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
};

export type UpdateBlockoutInput = {
  date?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
};
