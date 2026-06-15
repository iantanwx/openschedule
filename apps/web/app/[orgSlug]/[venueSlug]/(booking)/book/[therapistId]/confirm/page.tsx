import { ConfirmPage } from "./confirm-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; therapistId: string }>
}

export default async function ConfirmBookingPage({ params }: PageProps) {
  const { orgSlug, venueSlug, therapistId } = await params
  return <ConfirmPage orgSlug={orgSlug} venueSlug={venueSlug} therapistId={therapistId} />
}
