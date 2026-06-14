"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { TherapistHeader } from "@/components/therapist-header"
import { AvailabilityCalendar } from "@/components/availability-calendar"
import { TimeSlotList } from "@/components/time-slot-list"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    availability: {
      getSlots: FunctionReference<"query">
      getSlotsForAllTherapists: FunctionReference<"query">
    }
  }
}
const getSlots = convexApi.queries.availability.getSlots
const getSlotsForAllTherapists = convexApi.queries.availability.getSlotsForAllTherapists

type Slot = { startTime: string; endTime: string }
type SlotsByDate = Record<string, Slot[]>
type SlotsByTherapist = Record<string, Record<string, Slot[]>>

interface DateTimePageProps {
  orgSlug: string
  venueSlug: string
  therapistId: string
  venueId: string
}

export function DateTimePage({ orgSlug, venueSlug, therapistId, venueId }: DateTimePageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const singleSlots = useQuery(
    getSlots,
    therapistId !== "any" ? { venueId, therapistId } : "skip",
  ) as SlotsByDate | undefined

  const allSlots = useQuery(
    getSlotsForAllTherapists,
    therapistId === "any" ? { venueId } : "skip",
  ) as SlotsByTherapist | undefined

  const availableDates: SlotsByDate | undefined =
    therapistId === "any" ? mergeAllSlots(allSlots) : singleSlots

  const isLoading = availableDates === undefined

  const slotsForDate = selectedDate && availableDates ? (availableDates[selectedDate] ?? []) : []

  return (
    <div className="space-y-6">
      <TherapistHeader therapistId={therapistId} />

      {isLoading ? (
        <div className="flex gap-6">
          <Skeleton className="h-72 w-72" />
          <Skeleton className="h-72 flex-1" />
        </div>
      ) : (
        <>
          {Object.keys(availableDates).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No availability in the coming days
            </p>
          ) : (
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="shrink-0">
                <AvailabilityCalendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              </div>
              <div className="flex-1">
                {selectedDate ? (
                  <TimeSlotList
                    slots={slotsForDate}
                    selectedDate={selectedDate}
                    therapistId={therapistId}
                    orgSlug={orgSlug}
                    venueSlug={venueSlug}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a date to see available times
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function mergeAllSlots(allSlots: SlotsByTherapist | undefined): SlotsByDate | undefined {
  if (allSlots === undefined) return undefined

  const merged: SlotsByDate = {}

  for (const therapistSlots of Object.values(allSlots)) {
    for (const [date, slots] of Object.entries(therapistSlots)) {
      if (!merged[date]) {
        merged[date] = []
      }
      const existing = merged[date]
      for (const slot of slots) {
        if (!existing.some((s) => s.startTime === slot.startTime)) {
          existing.push(slot)
        }
      }
    }
  }

  for (const date of Object.keys(merged)) {
    const dateSlots = merged[date]
    if (dateSlots) {
      dateSlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
  }

  return merged
}
