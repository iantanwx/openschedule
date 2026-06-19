import { CancelPage } from "./cancel-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; bookingId: string }>
}

export default async function CancelBookingPage({ params }: PageProps) {
  const { orgSlug, venueSlug, bookingId } = await params
  return (
    <CancelPage orgSlug={orgSlug} venueSlug={venueSlug} bookingId={bookingId} />
  )
}
