"use client"

import { DayPicker } from "react-day-picker"
import { isBefore, startOfDay, parseISO } from "date-fns"
import "react-day-picker/style.css"

interface AvailabilityCalendarProps {
  availableDates: Record<string, { startTime: string; endTime: string }[]>
  selectedDate: string | null
  onDateSelect: (date: string) => void
}

export function AvailabilityCalendar({
  availableDates,
  selectedDate,
  onDateSelect,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date())

  const availableDateObjects = Object.keys(availableDates)
    .filter((d) => {
      const slots = availableDates[d]
      return slots && slots.length > 0
    })
    .map((d) => parseISO(d))

  const selectedDateObject = selectedDate ? parseISO(selectedDate) : undefined

  function handleDayClick(day: Date) {
    const dateStr = formatDateToISO(day)
    const slots = availableDates[dateStr]
    if (slots && slots.length > 0) {
      onDateSelect(dateStr)
    }
  }

  function isDisabled(day: Date): boolean {
    if (isBefore(day, today)) return true
    const dateStr = formatDateToISO(day)
    const slots = availableDates[dateStr]
    return !slots || slots.length === 0
  }

  return (
    <DayPicker
      mode="single"
      selected={selectedDateObject}
      onDayClick={handleDayClick}
      disabled={isDisabled}
      modifiers={{ available: availableDateObjects }}
      modifiersClassNames={{ available: "rdp-day--available" }}
      className="rounded-lg border p-3"
      classNames={{
        today: "font-bold",
        selected: "bg-primary text-primary-foreground rounded-md",
        disabled: "text-muted-foreground/40 cursor-not-allowed",
      }}
    />
  )
}

function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
