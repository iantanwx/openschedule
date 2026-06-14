import { Doc } from "../_generated/dataModel";

/** Full schedule */
export type Schedule = Pick<Doc<"schedules">, "_id" | "_creationTime" | "therapistId" | "venueId" | "workingDays" | "startTime" | "endTime" | "slotDuration" | "availabilityHorizonDays">;
