"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Button } from "@openschedule/ui/components/button"
import { Input } from "@openschedule/ui/components/input"
import { Label } from "@openschedule/ui/components/label"
import { Card } from "@openschedule/ui/components/card"
import { z } from "zod"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    availability: { getSlotsForAllTherapists: FunctionReference<"query"> }
    users: { getPublic: FunctionReference<"query"> }
  }
  mutations: {
    customers: { getOrCreate: FunctionReference<"mutation"> }
    bookings: { create: FunctionReference<"mutation"> }
  }
}

const availabilityGetSlots = convexApi.queries.availability.getSlotsForAllTherapists
const usersGetPublic = convexApi.queries.users.getPublic
const customersGetOrCreate = convexApi.mutations.customers.getOrCreate
const bookingsCreate = convexApi.mutations.bookings.create

const bookingFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Phone number is required"),
  notes: z.string().optional(),
})

interface BookingFormProps {
  orgSlug: string
  venueSlug: string
  venueId: string
  orgId: string
  therapistId: string
  date: string
  time: string
  endTime: string | null
  serviceId: string | null
}

export function BookingForm({
  orgSlug,
  venueSlug,
  venueId,
  orgId,
  therapistId,
  date,
  time,
  endTime,
  serviceId,
}: BookingFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const getOrCreateCustomer = useMutation(customersGetOrCreate)
  const createBooking = useMutation(bookingsCreate)

  // For "any" flow — resolve which therapist to assign
  const allSlots = useQuery(
    availabilityGetSlots,
    therapistId === "any" && serviceId ? { venueId, serviceId } : "skip",
  )

  const resolvedTherapistId = therapistId === "any"
    ? resolveRandomTherapist(allSlots, date, time)
    : therapistId

  // Show who they'll be seeing for the "any" flow
  const assignedUser = useQuery(
    usersGetPublic,
    resolvedTherapistId ? { id: resolvedTherapistId } : "skip",
  ) as { _id: string; name: string } | null | undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)

    const result = bookingFormSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    if (!resolvedTherapistId || !endTime) {
      setSubmitError("Unable to resolve booking details. Please go back and try again.")
      return
    }

    setIsSubmitting(true)

    try {
      const customerId = await getOrCreateCustomer({
        orgId,
        email: result.data.email,
        name: result.data.name,
        phone: result.data.phone,
      })

      const bookingId = await createBooking({
        venueId,
        therapistId: resolvedTherapistId,
        customerId,
        date,
        startTime: time,
        endTime,
        createdBy: "customer",
        ...(serviceId ? { serviceId: serviceId as any } : {}),
      })

      router.push(`/${orgSlug}/${venueSlug}/bookings/${bookingId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      if (message.includes("conflict") || message.includes("already booked") || message.includes("overlaps")) {
        toast.error("This time slot is no longer available")
        router.push(`/${orgSlug}/${venueSlug}/book/${therapistId}`)
        return
      }
      setSubmitError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirm your booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(date)} at {formatTime(time)}
        </p>
      </div>

      {therapistId === "any" && assignedUser && (
        <Card className="p-4">
          <p className="text-sm">
            You&apos;ll be seeing <span className="font-medium">{assignedUser.name}</span>
          </p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Your full name"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Anything we should know?"
          />
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Booking..." : "Confirm Booking"}
        </Button>
      </form>
    </div>
  )
}

function resolveRandomTherapist(
  allSlots: Record<string, Record<string, { startTime: string; endTime: string }[]>> | undefined | null,
  date: string,
  time: string,
): string | null {
  if (!allSlots) return null

  const available: string[] = []
  for (const [therapistId, dateMap] of Object.entries(allSlots)) {
    const slots = dateMap[date]
    if (slots && slots.some((s: { startTime: string }) => s.startTime === time)) {
      available.push(therapistId)
    }
  }

  if (available.length === 0) return null
  const randomIndex = Math.floor(Math.random() * available.length)
  const picked = available[randomIndex]
  if (!picked) return null
  return picked
}

function formatDate(date: string): string {
  const parts = date.split("-")
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string): string {
  const parts = time.split(":")
  const h = Number(parts[0])
  const minutes = parts[1] ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
