import { TherapistSelectionPage } from "./therapist-selection-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; serviceSlug: string }>
}

export default async function ServiceTherapistPage({ params }: PageProps) {
  const { orgSlug, venueSlug, serviceSlug } = await params
  return <TherapistSelectionPage orgSlug={orgSlug} venueSlug={venueSlug} serviceSlug={serviceSlug} />
}
