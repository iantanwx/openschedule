import type { ReactNode } from "react"
import { BookingLayout } from "@/components/booking-layout"

interface LayoutProps {
  children: ReactNode
  params: Promise<{ orgSlug: string; venueSlug: string }>
}

export default async function VenueBookingLayout({ children, params }: LayoutProps) {
  const { orgSlug, venueSlug } = await params
  return <BookingLayout orgSlug={orgSlug} venueSlug={venueSlug}>{children}</BookingLayout>
}
