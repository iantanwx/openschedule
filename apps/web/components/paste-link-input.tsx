"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@openschedule/ui/components/input"
import { Button } from "@openschedule/ui/components/button"

export function PasteLinkInput() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [link, setLink] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleGo() {
    setError(null)

    // Try to parse the URL path to extract /:orgSlug/:venueSlug
    let pathname = link.trim()

    // If it looks like a full URL, extract the pathname
    if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
      try {
        const url = new URL(pathname)
        pathname = url.pathname
      } catch {
        setError("Invalid booking link format")
        return
      }
    }

    // Remove leading slash
    if (pathname.startsWith("/")) {
      pathname = pathname.slice(1)
    }

    // Remove trailing slash
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1)
    }

    const segments = pathname.split("/")
    if (segments.length < 2 || !segments[0] || !segments[1]) {
      setError("Invalid booking link format")
      return
    }

    const orgSlug = segments[0]
    const venueSlug = segments[1]

    router.push(`/${orgSlug}/${venueSlug}`)
  }

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Have a booking link? Paste it here
      </button>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Paste your booking link..."
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleGo()
          }}
          aria-label="Booking link"
        />
        <Button size="sm" onClick={handleGo} disabled={!link.trim()}>
          Go
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
