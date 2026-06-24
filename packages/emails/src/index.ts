// Templates
export { BookingCreated, bookingCreatedPlainText } from "./templates/booking-created";
export type { BookingCreatedProps } from "./templates/booking-created";
export { BookingCancelled, bookingCancelledPlainText } from "./templates/booking-cancelled";
export type { BookingCancelledProps } from "./templates/booking-cancelled";
export { BookingRescheduled, bookingRescheduledPlainText } from "./templates/booking-rescheduled";
export type { BookingRescheduledProps } from "./templates/booking-rescheduled";
export { Invitation, invitationPlainText } from "./templates/invitation";
export type { InvitationProps } from "./templates/invitation";
export { EmailVerification, emailVerificationPlainText } from "./templates/email-verification";
export type { EmailVerificationProps } from "./templates/email-verification";

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
