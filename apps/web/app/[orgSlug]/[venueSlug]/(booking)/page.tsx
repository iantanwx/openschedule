import { ServicesPage } from "./services-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string }>
}

export default async function VenueHomePage({ params }: PageProps) {
  const { orgSlug, venueSlug } = await params
  return <ServicesPage orgSlug={orgSlug} venueSlug={venueSlug} />
}
