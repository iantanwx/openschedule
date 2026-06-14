"use client"

import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar"
import { Skeleton } from "@openschedule/ui/components/skeleton"

// FilterApi doesn't fully resolve across package boundaries in monorepo .d.ts
const convexApi = api as unknown as {
  queries: {
    users: { getPublic: FunctionReference<"query"> }
  }
}
const usersGetPublic = convexApi.queries.users.getPublic

interface TherapistHeaderProps {
  therapistId: string
}

export function TherapistHeader({ therapistId }: TherapistHeaderProps) {
  if (therapistId === "any") {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">Any available therapist</p>
          <p className="text-sm text-muted-foreground">We&apos;ll assign the best match</p>
        </div>
      </div>
    )
  }

  return <TherapistHeaderWithData therapistId={therapistId} />
}

function TherapistHeaderWithData({ therapistId }: { therapistId: string }) {
  const user = useQuery(usersGetPublic, { id: therapistId }) as
    | { _id: string; name: string }
    | null
    | undefined

  if (user === undefined) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
    )
  }

  if (!user) {
    return <p className="text-sm text-destructive">Therapist not found</p>
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <p className="font-medium">{user.name}</p>
    </div>
  )
}
