import { LandingHero } from "@/components/landing-hero"
import { BusinessCarousel } from "@/components/business-carousel"

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LandingHero />
      <BusinessCarousel />
    </div>
  )
}
