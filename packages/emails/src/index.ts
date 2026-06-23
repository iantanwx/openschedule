// Templates
export { BookingCreated, bookingCreatedPlainText } from "./templates/booking-created";
export { BookingCancelled, bookingCancelledPlainText } from "./templates/booking-cancelled";
export { BookingRescheduled, bookingRescheduledPlainText } from "./templates/booking-rescheduled";
export { Invitation, invitationPlainText } from "./templates/invitation";

// Components
export { EmailLayout } from "./components/email-layout";
export { DetailsCard } from "./components/details-card";
export { StaticMap } from "./components/static-map";
export { EmailButton } from "./components/email-button";
export { StatusBadge } from "./components/status-badge";

// Lib
export { generateIcs } from "./lib/ics";
export type { IcsEventData } from "./lib/ics";
export { buildGoogleCalendarUrl } from "./lib/calendar-url";
export type { CalendarUrlData } from "./lib/calendar-url";
