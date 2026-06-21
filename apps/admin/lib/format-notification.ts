import { CalendarPlus, CalendarX, Clock, UserPlus } from "lucide-react";
import type { ComponentType } from "react";

export interface FormattedNotification {
  icon: ComponentType<{ className?: string }>;
  text: string;
}

type NotificationType =
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "therapist_joined";

export function formatNotification(
  type: NotificationType,
  payload: Record<string, unknown>,
): FormattedNotification {
  switch (type) {
    case "booking_created":
      return {
        icon: CalendarPlus,
        text: `New booking — ${payload.customerName}, ${payload.date} at ${payload.startTime}`,
      };
    case "booking_cancelled":
      return {
        icon: CalendarX,
        text: `Booking cancelled — ${payload.customerName}, ${payload.date} at ${payload.startTime}`,
      };
    case "booking_rescheduled":
      return {
        icon: Clock,
        text: `Booking rescheduled — ${payload.customerName}, now ${payload.newDate} at ${payload.newStartTime}`,
      };
    case "therapist_joined":
      return {
        icon: UserPlus,
        text: `${payload.therapistName} joined the team`,
      };
    default:
      return {
        icon: CalendarPlus,
        text: "New notification",
      };
  }
}
