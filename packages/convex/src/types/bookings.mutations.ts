import { Id } from "../_generated/dataModel";

export type CreateBookingInput = {
  venueId: Id<"venues">;
  therapistId: Id<"users">;
  customerId: Id<"customers">;
  date: string;
  startTime: string;
  endTime: string;
  createdBy: "customer" | "therapist" | "owner";
  overCapacity?: boolean;
};
