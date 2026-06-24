"use client"

import { SearchInput } from "./search-input"
import { PasteLinkInput } from "./paste-link-input"

export function LandingHero() {
  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Book wellness services nearby
        </h1>
        <p className="text-muted-foreground">
          Discover studios and book your next appointment
        </p>
      </div>

      <SearchInput />

      <PasteLinkInput />
    </section>
  )
}
