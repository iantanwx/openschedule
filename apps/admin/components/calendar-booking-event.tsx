"use client";

import { cn } from "@openschedule/ui/lib/utils";

interface CalendarBookingEventProps {
  calendarEvent: {
    id: string;
    title: string;
    start: string;
    end: string;
    _customContent?: {
      customerName: string;
      therapistName: string;
      status: "pending" | "confirmed" | "cancelled";
      startTime: string;
      endTime: string;
    };
  };
}

export function CalendarBookingEvent({ calendarEvent }: CalendarBookingEventProps) {
  const content = calendarEvent._customContent;
  if (!content) {
    return <div className="text-xs">{calendarEvent.title}</div>;
  }

  const statusStyles: Record<string, string> = {
    confirmed: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    pending: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    cancelled: "border-l-muted bg-muted/50 opacity-60",
  };

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded-r-sm border-l-[3px] px-1.5 py-0.5",
        statusStyles[content.status] ?? "border-l-muted bg-muted/50",
      )}
    >
      <p className="truncate text-xs font-medium text-foreground">
        {content.customerName}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {content.therapistName} · {content.startTime}–{content.endTime}
      </p>
    </div>
  );
}
