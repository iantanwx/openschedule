import { Id } from "../_generated/dataModel";

export type CreateVenueInput = {
  orgId: Id<"organizations">;
  name: string;
  slug: string;
  timezone: string;
  capacity: number;
  dayStart: string;
  dayEnd: string;
};

export type UpdateVenueInput = {
  name?: string;
  slug?: string;
  timezone?: string;
  capacity?: number;
  dayStart?: string;
  dayEnd?: string;
};
