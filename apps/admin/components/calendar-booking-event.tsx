"use client"

import { cn } from "@opencal/ui/lib/utils"

interface CalendarBookingEventProps {
  calendarEvent: {
    id: string
    title: string
    start: string
    end: string
    _type?: string
    _customerName?: string
    _therapistName?: string
    _status?: "pending" | "confirmed" | "cancelled"
    _startTime?: string
    _endTime?: string
    _reason?: string
    [key: string]: unknown
  }
}

const STATUS_CONFIG = {
  confirmed: {
    border: "border-l-emerald-500",
    ring: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "Confirmed",
  },
  pending: {
    border: "border-l-amber-500",
    ring: "border-amber-300 dark:border-amber-700",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    label: "Pending",
  },
  cancelled: {
    border: "border-l-gray-400",
    ring: "border-gray-300 dark:border-gray-600",
    bg: "bg-muted/50",
    label: "Cancelled",
  },
} as const

export function CalendarBookingEvent({
  calendarEvent,
}: CalendarBookingEventProps) {
  // OoO event
  if (calendarEvent._type === "ooo") {
    return (
      <div className="h-full w-full overflow-hidden rounded-sm border border-dashed border-indigo-400 bg-indigo-50/50 px-1.5 py-0.5 dark:border-indigo-500 dark:bg-indigo-950/30">
        <p className="truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {(calendarEvent._therapistName as string) ?? ""} — OoO
        </p>
        {calendarEvent._reason && (
          <p className="truncate text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
            {calendarEvent._reason as string}
          </p>
        )}
      </div>
    )
  }

  // Booking event
  if (calendarEvent._type !== "booking") {
    return <div className="text-xs">{calendarEvent.title}</div>
  }

  const status = calendarEvent._status ?? "confirmed"
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded-r-sm border border-l-[3px] px-1.5 py-0.5",
        config.border,
        config.ring,
        config.bg,
      )}
    >
      <p className="truncate text-xs font-medium text-foreground">
        {calendarEvent._customerName ?? calendarEvent.title}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {calendarEvent._startTime}–{calendarEvent._endTime} · {calendarEvent._therapistName}
      </p>
      <p className="truncate text-[10px] font-medium text-muted-foreground">
        {config.label}
      </p>
    </div>
  )
}
