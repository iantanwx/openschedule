"use client"

import Link from "next/link"
import { Card } from "@openschedule/ui/components/card"

interface ServiceCardProps {
  id: string
  slug: string
  name: string
  description: string
  duration: number
  price: number
  color: string
  orgSlug: string
  venueSlug: string
}

export function ServiceCard({ slug, name, description, duration, price, color, orgSlug, venueSlug }: ServiceCardProps) {
  const href = `/${orgSlug}/${venueSlug}/book/service/${slug}`

  return (
    <Link href={href}>
      <Card className="flex cursor-pointer items-start gap-4 p-5 transition-colors hover:bg-accent">
        <div className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="flex-1 space-y-1">
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>{duration} min</span>
            <span>${(price / 100).toFixed(2)}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
