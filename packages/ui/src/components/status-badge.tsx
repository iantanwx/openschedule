"use client"

import { Badge } from "./badge"
import { cn } from "@opencal/ui/lib/utils"

type BookingStatus = "confirmed" | "pending" | "cancelled"

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as BookingStatus]
  if (!config) {
    return <Badge variant="secondary" className={className}>{status}</Badge>
  }
  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
