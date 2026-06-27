"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SearchInput } from "./search-input"
import { PasteLinkInput } from "./paste-link-input"

export function LandingHero() {
  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          OpenCal
        </h1>
        <p className="text-lg text-muted-foreground">
          Online scheduling for fitness, wellness and performance businesses in South-East Asia.
        </p>
        <p className="text-sm text-muted-foreground">
          Free for any business with less than US$1M in annual revenue.
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <SearchInput />
        <PasteLinkInput />
      </div>

      <Link
        href="https://app.opencal.xyz/signup"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Are you a business owner? Sign up for free
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}
