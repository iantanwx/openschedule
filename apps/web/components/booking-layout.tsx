"use client"

import type { ReactNode } from "react"
import { BookingSummary } from "./booking-summary"

interface BookingLayoutProps {
  children: ReactNode
  orgSlug: string
  venueSlug: string
}

export function BookingLayout({ children, orgSlug, venueSlug }: BookingLayoutProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row md:gap-8 md:px-6 md:py-10">
      <aside className="sticky top-0 z-10 border-b bg-background px-4 py-3 md:relative md:w-80 md:shrink-0 md:border-b-0 md:border-r md:py-0">
        <BookingSummary orgSlug={orgSlug} venueSlug={venueSlug} />
      </aside>
      <main className="flex-1 px-4 py-6 md:px-0">{children}</main>
    </div>
  )
}
