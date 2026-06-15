"use client"

import { BookingConfirmation } from "@/components/booking-confirmation"

interface ConfirmationPageProps {
  bookingId: string
}

export function ConfirmationPage({ bookingId }: ConfirmationPageProps) {
  return <BookingConfirmation bookingId={bookingId} />
}
