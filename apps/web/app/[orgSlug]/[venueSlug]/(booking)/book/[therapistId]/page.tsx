import { DateTimePageWrapper } from "./date-time-page-wrapper"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; therapistId: string }>
}

export default async function BookTherapistPage({ params }: PageProps) {
  const { orgSlug, venueSlug, therapistId } = await params
  return (
    <DateTimePageWrapper
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      therapistId={therapistId}
    />
  )
}
