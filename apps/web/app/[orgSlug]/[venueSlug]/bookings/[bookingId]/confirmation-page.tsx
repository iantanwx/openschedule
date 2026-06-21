"use client"

import { BookingConfirmation } from "@/components/booking-confirmation"

interface ConfirmationPageProps {
  bookingId: string
  orgSlug: string
  venueSlug: string
}

export function ConfirmationPage({ bookingId, orgSlug, venueSlug }: ConfirmationPageProps) {
  return <BookingConfirmation bookingId={bookingId} orgSlug={orgSlug} venueSlug={venueSlug} />
}
