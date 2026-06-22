import { Doc } from "../_generated/dataModel";

/** Full booking for admin */
export type Booking = Pick<Doc<"bookings">, "_id" | "_creationTime" | "venueId" | "therapistId" | "customerId" | "date" | "startTime" | "endTime" | "status" | "createdBy" | "overCapacity" | "serviceId">;

/** Booking for customer app (no createdBy/overCapacity exposed) */
export type BookingPublic = Pick<Doc<"bookings">, "_id" | "venueId" | "therapistId" | "date" | "startTime" | "endTime" | "status">;
