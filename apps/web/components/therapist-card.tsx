"use client"

import Link from "next/link"
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar"
import { Card } from "@openschedule/ui/components/card"

interface TherapistCardProps {
  id: string
  name: string
  orgSlug: string
  venueSlug: string
  isWildcard?: boolean
  hrefOverride?: string
}

export function TherapistCard({ id, name, orgSlug, venueSlug, isWildcard, hrefOverride }: TherapistCardProps) {
  const href = hrefOverride ?? `/${orgSlug}/${venueSlug}/book/${isWildcard ? "any" : id}`

  return (
    <Link href={href}>
      <Card className="flex cursor-pointer flex-col items-center gap-3 p-6 transition-colors hover:bg-accent">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl">
            {isWildcard ? "?" : getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <p className="text-center text-sm font-medium">
          {isWildcard ? "Any available" : name}
        </p>
      </Card>
    </Link>
  )
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
