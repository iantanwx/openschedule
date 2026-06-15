import Link from "next/link"

export default function VenueNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Venue not found</h1>
        <p className="mt-2 text-muted-foreground">
          The venue you&#39;re looking for doesn&#39;t exist or has been removed.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
