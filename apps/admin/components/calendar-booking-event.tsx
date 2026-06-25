"use client";

import { cn } from "@openschedule/ui/lib/utils";

interface CalendarBookingEventProps {
  calendarEvent: {
    id: string;
    title: string;
    start: string;
    end: string;
    _customContent?: {
      type: string;
      customerName: string;
      therapistName: string;
      status: "pending" | "confirmed" | "cancelled";
      startTime: string;
      endTime: string;
    };
  };
  hasStartDate?: boolean;
}

const STATUS_CONFIG = {
  confirmed: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "Confirmed",
  },
  pending: {
    border: "border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    label: "Pending",
  },
  cancelled: {
    border: "border-l-gray-400",
    bg: "bg-muted/50",
    label: "Cancelled",
  },
} as const;

export function CalendarBookingEvent({ calendarEvent }: CalendarBookingEventProps) {
  const content = calendarEvent._customContent;

  // If this is an OoO event rendered through this component, delegate styling
  if (content?.type === "ooo") {
    return (
      <div className="h-full w-full overflow-hidden rounded-sm border border-dashed border-indigo-400 bg-indigo-50/50 px-1.5 py-0.5 dark:border-indigo-500 dark:bg-indigo-950/30">
        <p className="truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {(content as unknown as { therapistName: string }).therapistName} — OoO
        </p>
        {(content as unknown as { reason?: string }).reason && (
          <p className="truncate text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
            {(content as unknown as { reason?: string }).reason}
          </p>
        )}
      </div>
    );
  }

  if (!content || content.type !== "booking") {
    return <div className="text-xs">{calendarEvent.title}</div>;
  }

  const config = STATUS_CONFIG[content.status] ?? STATUS_CONFIG.confirmed;

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded-r-sm border-l-[3px] px-1.5 py-0.5",
        config.border,
        config.bg,
      )}
    >
      <p className="truncate text-xs font-medium text-foreground">
        {content.customerName}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {content.startTime}–{content.endTime} · {content.therapistName}
      </p>
      <p className="truncate text-[10px] font-medium text-muted-foreground">
        {config.label}
      </p>
    </div>
  );
}
