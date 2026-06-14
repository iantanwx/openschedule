import { TherapistGridPage } from "./therapist-grid-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string }>
}

export default async function VenueHomePage({ params }: PageProps) {
  const { orgSlug, venueSlug } = await params
  return <TherapistGridPage orgSlug={orgSlug} venueSlug={venueSlug} />
}
