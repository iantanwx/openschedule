"use client"

import { Button } from "@openschedule/ui/components/button"

interface TimeSlotListProps {
  slots: { startTime: string; endTime: string }[]
  selectedDate: string
  therapistId: string
  orgSlug: string
  venueSlug: string
  serviceId: string | null
}

export function TimeSlotList({
  slots,
  selectedDate,
  therapistId,
  orgSlug,
  venueSlug,
  serviceId,
}: TimeSlotListProps) {
  if (slots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No available times for this date
      </p>
    )
  }

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-2">
      {slots.map((slot) => (
        <TimeSlotButton
          key={slot.startTime}
          startTime={slot.startTime}
          endTime={slot.endTime}
          date={selectedDate}
          therapistId={therapistId}
          orgSlug={orgSlug}
          venueSlug={venueSlug}
          serviceId={serviceId}
        />
      ))}
    </div>
  )
}

function TimeSlotButton({
  startTime,
  endTime,
  date,
  therapistId,
  orgSlug,
  venueSlug,
  serviceId,
}: {
  startTime: string
  endTime: string
  date: string
  therapistId: string
  orgSlug: string
  venueSlug: string
  serviceId: string | null
}) {
  const serviceParam = serviceId ? `&serviceId=${serviceId}` : ""
  const href = `/${orgSlug}/${venueSlug}/book/${therapistId}/confirm?date=${date}&time=${startTime}&endTime=${endTime}${serviceParam}`

  return (
    <Button variant="outline" className="w-full justify-center" asChild>
      <a href={href}>{formatTime(startTime)}</a>
    </Button>
  )
}

function formatTime(time: string): string {
  const parts = time.split(":")
  const h = Number(parts[0])
  const minutes = parts[1] ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
