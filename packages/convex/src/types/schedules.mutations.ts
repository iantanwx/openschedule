import { Id } from "../_generated/dataModel";

export type UpsertScheduleInput = {
  therapistId: Id<"users">;
  venueId: Id<"venues">;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDuration: number;
  availabilityHorizonDays: number;
};
