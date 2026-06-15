import { ConfirmationPage } from "./confirmation-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; bookingId: string }>
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params
  return <ConfirmationPage bookingId={bookingId} />
}
