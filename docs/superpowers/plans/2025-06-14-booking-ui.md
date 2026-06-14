# Customer Booking UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the customer-facing booking UI — therapist selection → date/time picker → booking form → confirmation — as a route-per-step Next.js 16 app with real-time Convex data.

**Architecture:** Two-column layout (summary left, active step right) using a `(booking)` route group. Each step is its own route. All interactive components use Convex reactive `useQuery`. URL is the single source of truth for state.

**Tech Stack:** Next.js 16 (App Router), React 19, Convex (reactive queries/mutations), Tailwind v4, shadcn/ui (radix-nova), react-day-picker, zod, sonner.

---

## File Structure

```
apps/web/
  app/
    layout.tsx                          — root layout (exists, will add ConvexProvider)
    [orgSlug]/
      [venueSlug]/
        (booking)/
          layout.tsx                    — two-column booking shell
          page.tsx                      — therapist selection (server component wrapper)
          book/
            [therapistId]/
              page.tsx                  — date/time picker (server component wrapper)
              confirm/
                page.tsx               — booking form (server component wrapper)
        bookings/
          [bookingId]/
            page.tsx                   — standalone confirmation page
        not-found.tsx                  — 404 for invalid org/venue
  components/
    theme-provider.tsx                 — exists
    convex-provider.tsx                — NEW: ConvexClientProvider wrapper
    booking-layout.tsx                 — NEW: two-column layout client component
    booking-summary.tsx                — NEW: left panel summary
    therapist-grid.tsx                 — NEW: grid of therapist cards
    therapist-card.tsx                 — NEW: therapist card (+ wildcard variant)
    therapist-header.tsx               — NEW: header showing selected therapist
    availability-calendar.tsx          — NEW: react-day-picker with green dots
    time-slot-list.tsx                 — NEW: scrollable time slot buttons
    booking-form.tsx                   — NEW: name/email/phone/notes form
    booking-confirmation.tsx           — NEW: confirmation details + cancel
  lib/
    utils.ts                           — will add date formatting helpers

packages/ui/src/components/
  button.tsx                           — exists
  card.tsx                             — NEW (shadcn)
  input.tsx                            — NEW (shadcn)
  label.tsx                            — NEW (shadcn)
  badge.tsx                            — NEW (shadcn)
  avatar.tsx                           — NEW (shadcn)
  skeleton.tsx                         — NEW (shadcn)
```

---

### Task 1: Dependencies and shadcn Components

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/label.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/avatar.tsx`
- Create: `packages/ui/src/components/skeleton.tsx`

- [ ] **Step 1: Install dependencies in apps/web**

```bash
cd apps/web
pnpm add react-day-picker date-fns sonner
```

- [ ] **Step 2: Install react-day-picker in packages/ui**

```bash
cd packages/ui
pnpm add react-day-picker date-fns
```

- [ ] **Step 3: Add shadcn components to packages/ui**

```bash
cd packages/ui
pnpm dlx shadcn@latest add card input label badge avatar skeleton
```

If shadcn CLI doesn't work with the current config, create each component manually following the radix-nova patterns from the existing `button.tsx`.

- [ ] **Step 4: Verify exports work**

Ensure `packages/ui/package.json` exports already cover `./components/*` → `./src/components/*.tsx`. Check that `card`, `input`, `label`, `badge`, `avatar`, `skeleton` are importable from `@openschedule/ui/components/card` etc.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shadcn components and booking UI dependencies"
```

---

### Task 2: Convex Provider Setup

**Files:**
- Create: `apps/web/components/convex-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create ConvexProvider wrapper**

Create `apps/web/components/convex-provider.tsx`:

```tsx
"use client"

import { ConvexProvider, ConvexReactClient } from "convex/react"
import type { ReactNode } from "react"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
```

- [ ] **Step 2: Add ConvexProvider to root layout**

Modify `apps/web/app/layout.tsx` to wrap children with `ConvexClientProvider`:

```tsx
import { Geist, Geist_Mono } from "next/font/google"

import "@openschedule/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ConvexClientProvider } from "@/components/convex-provider"
import { cn } from "@openschedule/ui/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ConvexClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Add .env.local template**

Create `apps/web/.env.local.example`:

```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

- [ ] **Step 4: Verify the app still builds**

```bash
cd apps/web
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Convex provider to root layout"
```

---

### Task 3: Booking Layout Shell (Two-Column)

**Files:**
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/layout.tsx`
- Create: `apps/web/components/booking-layout.tsx`
- Create: `apps/web/components/booking-summary.tsx`

- [ ] **Step 1: Create the BookingLayout client component**

Create `apps/web/components/booking-layout.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import { BookingSummary } from "./booking-summary"

interface BookingLayoutProps {
  children: ReactNode
  orgSlug: string
  venueSlug: string
}

export function BookingLayout({ children, orgSlug, venueSlug }: BookingLayoutProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row md:gap-8 md:px-6 md:py-10">
      {/* Left column — summary */}
      <aside className="sticky top-0 z-10 border-b bg-background px-4 py-3 md:relative md:w-80 md:shrink-0 md:border-b-0 md:border-r md:py-0">
        <BookingSummary orgSlug={orgSlug} venueSlug={venueSlug} />
      </aside>
      {/* Right column — active step */}
      <main className="flex-1 px-4 py-6 md:px-0">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create the BookingSummary client component**

Create `apps/web/components/booking-summary.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { useParams, useSearchParams } from "next/navigation"
import { api } from "@openschedule/convex/api"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface BookingSummaryProps {
  orgSlug: string
  venueSlug: string
}

export function BookingSummary({ orgSlug, venueSlug }: BookingSummaryProps) {
  const params = useParams<{ therapistId?: string }>()
  const searchParams = useSearchParams()

  const date = searchParams.get("date")
  const time = searchParams.get("time")
  const therapistId = params.therapistId

  const org = useQuery(api.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(api.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  // Show venue info
  if (org === undefined || venue === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
    )
  }

  if (!org || !venue) {
    return <p className="text-sm text-muted-foreground">Venue not found</p>
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{venue.name}</h2>
      <p className="text-sm text-muted-foreground">{org.name}</p>

      {therapistId && therapistId !== "any" && (
        <div className="mt-4 border-t pt-3">
          <TherapistSummaryLine therapistId={therapistId} />
        </div>
      )}
      {therapistId === "any" && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm">Any available therapist</p>
        </div>
      )}

      {date && (
        <div className="mt-2">
          <p className="text-sm font-medium">{formatDate(date)}</p>
          {time && <p className="text-sm text-muted-foreground">{formatTime(time)}</p>}
        </div>
      )}
    </div>
  )
}

function TherapistSummaryLine({ therapistId }: { therapistId: string }) {
  // For now, show the ID — we'll resolve to name when users query is available
  return <p className="text-sm">Therapist selected</p>
}

function formatDate(date: string): string {
  // date is YYYY-MM-DD
  const [year, month, day] = date.split("-")
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string): string {
  // time is HH:MM
  const [hours, minutes] = time.split(":")
  const h = Number(hours)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
```

- [ ] **Step 3: Create the route layout**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/layout.tsx`:

```tsx
import type { ReactNode } from "react"
import { BookingLayout } from "@/components/booking-layout"

interface LayoutProps {
  children: ReactNode
  params: Promise<{ orgSlug: string; venueSlug: string }>
}

export default async function VenueBookingLayout({ children, params }: LayoutProps) {
  const { orgSlug, venueSlug } = await params
  return <BookingLayout orgSlug={orgSlug} venueSlug={venueSlug}>{children}</BookingLayout>
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd apps/web
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add two-column booking layout shell"
```

---

### Task 4: Therapist Selection Page

**Files:**
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/page.tsx`
- Create: `apps/web/components/therapist-grid.tsx`
- Create: `apps/web/components/therapist-card.tsx`

- [ ] **Step 1: Create TherapistCard component**

Create `apps/web/components/therapist-card.tsx`:

```tsx
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
}

export function TherapistCard({ id, name, orgSlug, venueSlug, isWildcard }: TherapistCardProps) {
  const href = `/${orgSlug}/${venueSlug}/book/${isWildcard ? "any" : id}`

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
```

- [ ] **Step 2: Create TherapistGrid component**

Create `apps/web/components/therapist-grid.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { TherapistCard } from "./therapist-card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface TherapistGridProps {
  venueId: Id<"venues">
  orgSlug: string
  venueSlug: string
}

export function TherapistGrid({ venueId, orgSlug, venueSlug }: TherapistGridProps) {
  const schedules = useQuery(api.queries.schedules.listByVenue, { venueId })

  if (schedules === undefined) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  // Deduplicate therapist IDs from schedules
  const therapistIds = [...new Set(schedules.map((s) => s.therapistId))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a therapist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a therapist or let us pick one for you
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {therapistIds.map((therapistId) => (
          <TherapistCardWithData
            key={therapistId}
            therapistId={therapistId}
            orgSlug={orgSlug}
            venueSlug={venueSlug}
          />
        ))}
        <TherapistCard
          id="any"
          name="Any available"
          orgSlug={orgSlug}
          venueSlug={venueSlug}
          isWildcard
        />
      </div>
    </div>
  )
}

function TherapistCardWithData({
  therapistId,
  orgSlug,
  venueSlug,
}: {
  therapistId: Id<"users">
  orgSlug: string
  venueSlug: string
}) {
  // We need a query to get user by ID — we'll use a simple query
  // For now, we'll show the ID until we add a users.get query
  // TODO: Replace with actual user name once users.getPublic query exists
  return (
    <TherapistCard
      id={therapistId}
      name="Therapist"
      orgSlug={orgSlug}
      venueSlug={venueSlug}
    />
  )
}
```

**Note:** We need a `users.getPublic` query that returns `{ _id, name }` for a user. This should be added to `packages/convex` as part of this task.

- [ ] **Step 3: Add users.getPublic query to Convex**

Create `packages/convex/src/queries/users.ts`:

```ts
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getPublic = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return { _id: user._id, name: user.name };
  },
});

export const listByVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_venueId", (q) => q.eq("venueId", args.venueId))
      .take(100);
    const therapistIds = [...new Set(schedules.map((s) => s.therapistId))];
    const users = await Promise.all(
      therapistIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        return { _id: user._id, name: user.name };
      }),
    );
    return users.filter((u) => u !== null);
  },
});
```

- [ ] **Step 4: Update TherapistGrid to use users.listByVenue**

Update `apps/web/components/therapist-grid.tsx` to call `api.queries.users.listByVenue` instead of `schedules.listByVenue`, and pass user names directly to `TherapistCard`.

```tsx
"use client"

import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { TherapistCard } from "./therapist-card"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface TherapistGridProps {
  venueId: Id<"venues">
  orgSlug: string
  venueSlug: string
}

export function TherapistGrid({ venueId, orgSlug, venueSlug }: TherapistGridProps) {
  const therapists = useQuery(api.queries.users.listByVenue, { venueId })

  if (therapists === undefined) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a therapist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a therapist or let us pick one for you
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {therapists.map((therapist) => (
          <TherapistCard
            key={therapist._id}
            id={therapist._id}
            name={therapist.name}
            orgSlug={orgSlug}
            venueSlug={venueSlug}
          />
        ))}
        <TherapistCard
          id="any"
          name="Any available"
          orgSlug={orgSlug}
          venueSlug={venueSlug}
          isWildcard
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the route page (server component wrapper)**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/page.tsx`:

```tsx
import { TherapistGridPage } from "./therapist-grid-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string }>
}

export default async function VenueHomePage({ params }: PageProps) {
  const { orgSlug, venueSlug } = await params
  return <TherapistGridPage orgSlug={orgSlug} venueSlug={venueSlug} />
}
```

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/therapist-grid-page.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import { TherapistGrid } from "@/components/therapist-grid"

interface TherapistGridPageProps {
  orgSlug: string
  venueSlug: string
}

export function TherapistGridPage({ orgSlug, venueSlug }: TherapistGridPageProps) {
  const org = useQuery(api.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(api.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  if (org === undefined || venue === undefined) {
    return null // Loading handled by layout skeleton
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return <TherapistGrid venueId={venue._id} orgSlug={orgSlug} venueSlug={venueSlug} />
}
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add therapist selection page and users query"
```

---

### Task 5: Availability Calendar Component

**Files:**
- Create: `apps/web/components/availability-calendar.tsx`

- [ ] **Step 1: Create AvailabilityCalendar component**

Create `apps/web/components/availability-calendar.tsx`:

```tsx
"use client"

import { DayPicker } from "react-day-picker"
import { isBefore, startOfDay, parseISO } from "date-fns"
import "react-day-picker/style.css"

interface AvailabilityCalendarProps {
  /** Record of YYYY-MM-DD → slot array (non-empty = available) */
  availableDates: Record<string, { startTime: string; endTime: string }[]>
  selectedDate: string | null
  onDateSelect: (date: string) => void
}

export function AvailabilityCalendar({
  availableDates,
  selectedDate,
  onDateSelect,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date())

  // Convert available dates to Date objects for the modifier
  const availableDateObjects = Object.keys(availableDates)
    .filter((d) => availableDates[d]!.length > 0)
    .map((d) => parseISO(d))

  const selectedDateObject = selectedDate ? parseISO(selectedDate) : undefined

  function handleDayClick(day: Date) {
    const dateStr = formatDateToISO(day)
    const slots = availableDates[dateStr]
    if (slots && slots.length > 0) {
      onDateSelect(dateStr)
    }
  }

  function isDisabled(day: Date): boolean {
    if (isBefore(day, today)) return true
    const dateStr = formatDateToISO(day)
    const slots = availableDates[dateStr]
    return !slots || slots.length === 0
  }

  return (
    <DayPicker
      mode="single"
      selected={selectedDateObject}
      onDayClick={handleDayClick}
      disabled={isDisabled}
      modifiers={{ available: availableDateObjects }}
      modifiersClassNames={{ available: "rdp-day--available" }}
      className="rounded-lg border p-3"
      classNames={{
        today: "font-bold",
        selected: "bg-primary text-primary-foreground rounded-md",
        disabled: "text-muted-foreground/40 cursor-not-allowed",
      }}
    />
  )
}

function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
```

- [ ] **Step 2: Add CSS for the green availability dot**

Add to `apps/web/app/globals.css` (or a local CSS module):

```css
.rdp-day--available::after {
  content: "";
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #22c55e;
  margin: 2px auto 0;
}
```

Note: If `apps/web` imports `@openschedule/ui/globals.css` for base styles, add this custom CSS in a separate file imported by the root layout, or in a scoped CSS module for the calendar. The implementer should check what approach works with the Tailwind v4 setup.

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/web
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add availability calendar component with green dots"
```

---

### Task 6: Time Slot List Component

**Files:**
- Create: `apps/web/components/time-slot-list.tsx`

- [ ] **Step 1: Create TimeSlotList component**

Create `apps/web/components/time-slot-list.tsx`:

```tsx
"use client"

import { Button } from "@openschedule/ui/components/button"

interface TimeSlotListProps {
  slots: { startTime: string; endTime: string }[]
  selectedDate: string
  therapistId: string
  orgSlug: string
  venueSlug: string
}

export function TimeSlotList({
  slots,
  selectedDate,
  therapistId,
  orgSlug,
  venueSlug,
}: TimeSlotListProps) {
  if (slots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No available times for this date
      </p>
    )
  }

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-2">
      {slots.map((slot) => (
        <TimeSlotButton
          key={slot.startTime}
          startTime={slot.startTime}
          date={selectedDate}
          therapistId={therapistId}
          orgSlug={orgSlug}
          venueSlug={venueSlug}
        />
      ))}
    </div>
  )
}

function TimeSlotButton({
  startTime,
  date,
  therapistId,
  orgSlug,
  venueSlug,
}: {
  startTime: string
  date: string
  therapistId: string
  orgSlug: string
  venueSlug: string
}) {
  const href = `/${orgSlug}/${venueSlug}/book/${therapistId}/confirm?date=${date}&time=${startTime}`

  return (
    <Button variant="outline" className="w-full justify-center" asChild>
      <a href={href}>{formatTime(startTime)}</a>
    </Button>
  )
}

function formatTime(time: string): string {
  const [hoursStr, minutes] = time.split(":")
  const h = Number(hoursStr)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add time slot list component"
```

---

### Task 7: Date/Time Picker Page

**Files:**
- Create: `apps/web/components/therapist-header.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/page.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/date-time-page.tsx`

- [ ] **Step 1: Create TherapistHeader component**

Create `apps/web/components/therapist-header.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar"
import { Skeleton } from "@openschedule/ui/components/skeleton"

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
          <p className="text-sm text-muted-foreground">We'll assign the best match</p>
        </div>
      </div>
    )
  }

  return <TherapistHeaderWithData therapistId={therapistId as Id<"users">} />
}

function TherapistHeaderWithData({ therapistId }: { therapistId: Id<"users"> }) {
  const user = useQuery(api.queries.users.getPublic, { id: therapistId })

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
```

- [ ] **Step 2: Create DateTimePage client component**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/date-time-page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { TherapistHeader } from "@/components/therapist-header"
import { AvailabilityCalendar } from "@/components/availability-calendar"
import { TimeSlotList } from "@/components/time-slot-list"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface DateTimePageProps {
  orgSlug: string
  venueSlug: string
  therapistId: string
  venueId: Id<"venues">
}

export function DateTimePage({ orgSlug, venueSlug, therapistId, venueId }: DateTimePageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Fetch availability — different query depending on therapist vs "any"
  const singleSlots = useQuery(
    api.queries.availability.getSlots,
    therapistId !== "any" ? { venueId, therapistId: therapistId as Id<"users"> } : "skip",
  )
  const allSlots = useQuery(
    api.queries.availability.getSlotsForAllTherapists,
    therapistId === "any" ? { venueId } : "skip",
  )

  // Merge all therapists' slots into a single map for "any" flow
  const availableDates = therapistId === "any" ? mergeAllSlots(allSlots) : (singleSlots ?? undefined)

  const isLoading = availableDates === undefined

  // Get slots for selected date
  const slotsForDate = selectedDate && availableDates ? (availableDates[selectedDate] ?? []) : []

  return (
    <div className="space-y-6">
      <TherapistHeader therapistId={therapistId} />

      {isLoading ? (
        <div className="flex gap-6">
          <Skeleton className="h-72 w-72" />
          <Skeleton className="h-72 flex-1" />
        </div>
      ) : (
        <>
          {Object.keys(availableDates).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No availability in the coming days
            </p>
          ) : (
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="shrink-0">
                <AvailabilityCalendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              </div>
              <div className="flex-1">
                {selectedDate ? (
                  <TimeSlotList
                    slots={slotsForDate}
                    selectedDate={selectedDate}
                    therapistId={therapistId}
                    orgSlug={orgSlug}
                    venueSlug={venueSlug}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a date to see available times
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Merge per-therapist slot maps into one combined map (union of all slots) */
function mergeAllSlots(
  allSlots: Record<string, Record<string, { startTime: string; endTime: string }[]>> | undefined | null,
): Record<string, { startTime: string; endTime: string }[]> | undefined {
  if (allSlots === undefined || allSlots === null) return undefined

  const merged: Record<string, { startTime: string; endTime: string }[]> = {}

  for (const therapistSlots of Object.values(allSlots)) {
    for (const [date, slots] of Object.entries(therapistSlots)) {
      if (!merged[date]) {
        merged[date] = []
      }
      for (const slot of slots) {
        // Only add if not already present (same start time)
        const existing = merged[date]!
        if (!existing.some((s) => s.startTime === slot.startTime)) {
          existing.push(slot)
        }
      }
    }
  }

  // Sort slots by startTime within each date
  for (const date of Object.keys(merged)) {
    merged[date]!.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return merged
}
```

- [ ] **Step 3: Create the route page (server component wrapper)**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/page.tsx`:

```tsx
import { DateTimePageWrapper } from "./date-time-page-wrapper"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; therapistId: string }>
}

export default async function BookTherapistPage({ params }: PageProps) {
  const { orgSlug, venueSlug, therapistId } = await params
  return (
    <DateTimePageWrapper
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      therapistId={therapistId}
    />
  )
}
```

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/date-time-page-wrapper.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import { DateTimePage } from "./date-time-page"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface Props {
  orgSlug: string
  venueSlug: string
  therapistId: string
}

export function DateTimePageWrapper({ orgSlug, venueSlug, therapistId }: Props) {
  const org = useQuery(api.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(api.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  if (org === undefined || venue === undefined) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return (
    <DateTimePage
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      therapistId={therapistId}
      venueId={venue._id}
    />
  )
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add date/time picker page with availability calendar"
```

---

### Task 8: Booking Form Page

**Files:**
- Create: `apps/web/components/booking-form.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/confirm/page.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/confirm/confirm-page.tsx`

- [ ] **Step 1: Create BookingForm component**

Create `apps/web/components/booking-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { Button } from "@openschedule/ui/components/button"
import { Input } from "@openschedule/ui/components/input"
import { Label } from "@openschedule/ui/components/label"
import { Card } from "@openschedule/ui/components/card"
import { z } from "zod"

const bookingFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Phone number is required"),
  notes: z.string().optional(),
})

interface BookingFormProps {
  orgSlug: string
  venueSlug: string
  venueId: Id<"venues">
  orgId: Id<"organizations">
  therapistId: string
  date: string
  time: string
}

export function BookingForm({
  orgSlug,
  venueSlug,
  venueId,
  orgId,
  therapistId,
  date,
  time,
}: BookingFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const getOrCreateCustomer = useMutation(api.mutations.customers.getOrCreate)
  const createBooking = useMutation(api.mutations.bookings.create)

  // For "any" flow — resolve which therapist to assign
  const allSlots = useQuery(
    api.queries.availability.getSlotsForAllTherapists,
    therapistId === "any" ? { venueId } : "skip",
  )

  // Determine the actual therapist ID for booking
  const resolvedTherapistId = therapistId === "any"
    ? resolveRandomTherapist(allSlots, date, time)
    : (therapistId as Id<"users">)

  // Show who they'll be seeing for the "any" flow
  const assignedUser = useQuery(
    api.queries.users.getPublic,
    resolvedTherapistId ? { id: resolvedTherapistId } : "skip",
  )

  // Compute endTime from venue schedule (slot duration)
  // For simplicity, we look up the schedule to get slot duration
  const schedule = useQuery(
    api.queries.schedules.getByTherapistAndVenue,
    resolvedTherapistId ? { therapistId: resolvedTherapistId, venueId } : "skip",
  )

  const endTime = schedule ? computeEndTime(time, schedule.slotDuration) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)

    const result = bookingFormSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    if (!resolvedTherapistId || !endTime) {
      setSubmitError("Unable to resolve therapist or time slot. Please go back and try again.")
      return
    }

    setIsSubmitting(true)

    try {
      const customerId = await getOrCreateCustomer({
        orgId,
        email: result.data.email,
        name: result.data.name,
        phone: result.data.phone,
      })

      const bookingId = await createBooking({
        venueId,
        therapistId: resolvedTherapistId,
        customerId,
        date,
        startTime: time,
        endTime,
        createdBy: "customer",
      })

      router.push(`/${orgSlug}/${venueSlug}/bookings/${bookingId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setSubmitError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirm your booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(date)} at {formatTime(time)}
        </p>
      </div>

      {therapistId === "any" && assignedUser && (
        <Card className="p-4">
          <p className="text-sm">
            You'll be seeing <span className="font-medium">{assignedUser.name}</span>
          </p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Your full name"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Anything we should know?"
          />
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Booking..." : "Confirm Booking"}
        </Button>
      </form>
    </div>
  )
}

function resolveRandomTherapist(
  allSlots: Record<string, Record<string, { startTime: string; endTime: string }[]>> | undefined | null,
  date: string,
  time: string,
): Id<"users"> | null {
  if (!allSlots) return null

  const available: string[] = []
  for (const [therapistId, dateMap] of Object.entries(allSlots)) {
    const slots = dateMap[date]
    if (slots && slots.some((s) => s.startTime === time)) {
      available.push(therapistId)
    }
  }

  if (available.length === 0) return null
  const randomIndex = Math.floor(Math.random() * available.length)
  return available[randomIndex] as Id<"users">
}

function computeEndTime(startTime: string, slotDuration: number): string {
  const [hoursStr, minutesStr] = startTime.split(":")
  const totalMinutes = Number(hoursStr) * 60 + Number(minutesStr) + slotDuration
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-")
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatTime(time: string): string {
  const [hoursStr, minutes] = time.split(":")
  const h = Number(hoursStr)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
```

- [ ] **Step 2: Create confirm page wrapper**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/confirm/confirm-page.tsx`:

```tsx
"use client"

import { useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import { api } from "@openschedule/convex/api"
import { BookingForm } from "@/components/booking-form"
import { Skeleton } from "@openschedule/ui/components/skeleton"

interface ConfirmPageProps {
  orgSlug: string
  venueSlug: string
  therapistId: string
}

export function ConfirmPage({ orgSlug, venueSlug, therapistId }: ConfirmPageProps) {
  const searchParams = useSearchParams()
  const date = searchParams.get("date")
  const time = searchParams.get("time")

  const org = useQuery(api.queries.organizations.getBySlug, { slug: orgSlug })
  const venue = useQuery(api.queries.venues.getBySlug, org ? { orgId: org._id, slug: venueSlug } : "skip")

  if (!date || !time) {
    return <p className="text-destructive">Missing date or time. Please go back and select a time slot.</p>
  }

  if (org === undefined || venue === undefined) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!org || !venue) {
    return <p>Venue not found</p>
  }

  return (
    <BookingForm
      orgSlug={orgSlug}
      venueSlug={venueSlug}
      venueId={venue._id}
      orgId={org._id}
      therapistId={therapistId}
      date={date}
      time={time}
    />
  )
}
```

- [ ] **Step 3: Create the route page**

Create `apps/web/app/[orgSlug]/[venueSlug]/(booking)/book/[therapistId]/confirm/page.tsx`:

```tsx
import { ConfirmPage } from "./confirm-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; therapistId: string }>
}

export default async function ConfirmBookingPage({ params }: PageProps) {
  const { orgSlug, venueSlug, therapistId } = await params
  return <ConfirmPage orgSlug={orgSlug} venueSlug={venueSlug} therapistId={therapistId} />
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add booking confirmation form page"
```

---

### Task 9: Booking Confirmation Page

**Files:**
- Create: `apps/web/components/booking-confirmation.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/page.tsx`
- Create: `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/confirmation-page.tsx`

- [ ] **Step 1: Create BookingConfirmation component**

Create `apps/web/components/booking-confirmation.tsx`:

```tsx
"use client"

import { useMutation, useQuery } from "convex/react"
import { api } from "@openschedule/convex/api"
import type { Id } from "@openschedule/convex/dataModel"
import { Button } from "@openschedule/ui/components/button"
import { Badge } from "@openschedule/ui/components/badge"
import { Card } from "@openschedule/ui/components/card"
import { useState } from "react"

interface BookingConfirmationProps {
  bookingId: Id<"bookings">
}

export function BookingConfirmation({ bookingId }: BookingConfirmationProps) {
  const booking = useQuery(api.queries.bookings.get, { id: bookingId })
  const cancelBooking = useMutation(api.mutations.bookings.cancel)
  const [isCancelling, setIsCancelling] = useState(false)

  if (booking === undefined) {
    return (
      <div className="mx-auto max-w-md animate-pulse space-y-4 py-12">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-40 rounded-lg bg-muted" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-muted-foreground">This booking may have been removed.</p>
      </div>
    )
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      await cancelBooking({ id: bookingId })
    } catch {
      setIsCancelling(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        {booking.status === "pending" && (
          <>
            <h1 className="text-2xl font-semibold">Booking requested</h1>
            <p className="mt-1 text-muted-foreground">Waiting for confirmation</p>
          </>
        )}
        {booking.status === "confirmed" && (
          <>
            <h1 className="text-2xl font-semibold">Booking confirmed</h1>
            <p className="mt-1 text-muted-foreground">You're all set</p>
          </>
        )}
        {booking.status === "cancelled" && (
          <>
            <h1 className="text-2xl font-semibold">Booking cancelled</h1>
            <p className="mt-1 text-muted-foreground">This booking has been cancelled</p>
          </>
        )}
      </div>

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <StatusBadge status={booking.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Date</span>
          <span className="text-sm font-medium">{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Time</span>
          <span className="text-sm font-medium">
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
        <TherapistLine therapistId={booking.therapistId} />
      </Card>

      {booking.status !== "cancelled" && (
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? "Cancelling..." : "Cancel Booking"}
        </Button>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "confirmed" ? "default" : status === "cancelled" ? "destructive" : "secondary"
  return <Badge variant={variant}>{status}</Badge>
}

function TherapistLine({ therapistId }: { therapistId: Id<"users"> }) {
  const user = useQuery(api.queries.users.getPublic, { id: therapistId })
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Therapist</span>
      <span className="text-sm font-medium">{user?.name ?? "..."}</span>
    </div>
  )
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-")
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })
}

function formatTime(time: string): string {
  const [hoursStr, minutes] = time.split(":")
  const h = Number(hoursStr)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
```

- [ ] **Step 2: Create confirmation page wrapper**

Create `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/confirmation-page.tsx`:

```tsx
"use client"

import type { Id } from "@openschedule/convex/dataModel"
import { BookingConfirmation } from "@/components/booking-confirmation"

interface ConfirmationPageProps {
  bookingId: string
}

export function ConfirmationPage({ bookingId }: ConfirmationPageProps) {
  return <BookingConfirmation bookingId={bookingId as Id<"bookings">} />
}
```

- [ ] **Step 3: Create the route page**

Create `apps/web/app/[orgSlug]/[venueSlug]/bookings/[bookingId]/page.tsx`:

```tsx
import { ConfirmationPage } from "./confirmation-page"

interface PageProps {
  params: Promise<{ orgSlug: string; venueSlug: string; bookingId: string }>
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params
  return <ConfirmationPage bookingId={bookingId} />
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add booking confirmation and cancellation page"
```

---

### Task 10: Toast Notifications (Sonner)

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Add Toaster to root layout**

Modify `apps/web/app/layout.tsx` to include the Sonner `<Toaster />`:

```tsx
import { Toaster } from "sonner"

// ... inside <body>, after ThemeProvider:
<Toaster position="top-center" />
```

- [ ] **Step 2: Add toast to BookingForm on error**

In `apps/web/components/booking-form.tsx`, when `submitError` is a "slot taken" error, use `toast.error()` from sonner and redirect back:

```tsx
import { toast } from "sonner"

// In the catch block of handleSubmit:
if (message.includes("conflict") || message.includes("already booked")) {
  toast.error("This time slot is no longer available")
  router.push(`/${orgSlug}/${venueSlug}/book/${therapistId}`)
  return
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/web
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add toast notifications for booking errors"
```

---

### Task 11: Not Found and Error Handling

**Files:**
- Create: `apps/web/app/[orgSlug]/[venueSlug]/not-found.tsx`
- Create: `apps/web/app/not-found.tsx`

- [ ] **Step 1: Create root not-found page**

Create `apps/web/app/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create venue-level not-found page**

Create `apps/web/app/[orgSlug]/[venueSlug]/not-found.tsx`:

```tsx
import Link from "next/link"

export default function VenueNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Venue not found</h1>
        <p className="mt-2 text-muted-foreground">
          The venue you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add not-found pages for booking UI"
```

---

### Task 12: Final Verification and Cleanup

**Files:**
- Possibly modify any file with type issues

- [ ] **Step 1: Run full typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter web typecheck
```

Fix any type errors that surface.

- [ ] **Step 2: Run convex tests**

```bash
cd packages/convex
pnpm test
```

Ensure all 13 existing tests still pass.

- [ ] **Step 3: Run build**

```bash
cd apps/web
pnpm build
```

Fix any build errors.

- [ ] **Step 4: Remove any placeholder root page**

Update `apps/web/app/page.tsx` to redirect to a sensible default or show a landing placeholder. Since the real entry is `/:orgSlug/:venueSlug`, the root page can remain minimal.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup for booking UI"
```
