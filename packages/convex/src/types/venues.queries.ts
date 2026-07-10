import { Doc } from "../_generated/dataModel";

/** Full venue for admin */
export type Venue = Pick<Doc<"venues">, "_id" | "_creationTime" | "orgId" | "name" | "slug" | "timezone" | "capacity" | "dayStart" | "dayEnd" | "status" | "address" | "coordinates" | "placeId" | "description" | "coverImageId" | "minAdvanceBookingEnabled" | "minAdvanceBookingMinutes">;

/** Public venue info for customer app (no capacity exposed) */
export type VenuePublic = Pick<Doc<"venues">, "_id" | "name" | "slug" | "timezone" | "address" | "coordinates" | "placeId" | "description" | "coverImageId">;
