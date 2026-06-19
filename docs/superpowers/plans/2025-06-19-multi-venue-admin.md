# Multi-Venue Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-venue assumption in the admin app with venue-scoped routes and an org-level dashboard.

**Architecture:** Hybrid routing — org dashboard at `/:orgSlug` with venue cards + aggregated today, venue-specific views at `/:orgSlug/venues/:venueSlug/(today|bookings|schedule|settings)`. Breadcrumb nav with venue switcher dropdown. One new backend query (`getBySlugFull`).

**Tech Stack:** Next.js 16 (App Router), React 19, Convex, shadcn/ui, Tailwind CSS, lucide-react

---

## File Structure

### Backend (1 new query)
- Create: `packages/convex/src/queries/venues.ts` — add `getBySlugFull` export

### Admin Routes (restructured)
- Delete: `apps/admin/app/(protected)/[orgSlug]/(tabs)/` (entire directory — 4 pages + layout)
- Create: `apps/admin/app/(protected)/[orgSlug]/(dashboard)/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/team/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/settings/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/bookings/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/schedule/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx`

### Components (new + modified)
- Create: `apps/admin/components/org-dashboard-page.tsx`
- Create: `apps/admin/components/venue-card.tsx`
- Create: `apps/admin/components/venue-switcher.tsx`
- Create: `apps/admin/components/venue-settings-page.tsx`
- Create: `apps/admin/components/org-nav.tsx`
- Create: `apps/admin/components/create-venue-card.tsx`
- Create: `apps/admin/components/org-settings-wrapper.tsx`
- Modify: `apps/admin/components/top-bar.tsx` — breadcrumb + venue switcher
- Modify: `apps/admin/components/tab-bar.tsx` — venue-scoped links
- Modify: `apps/admin/components/today-page.tsx` — accept venueId/venue props instead of fetching venues[0]
- Modify: `apps/admin/components/bookings-page.tsx` — same
- Modify: `apps/admin/components/schedule-page.tsx` — same
- Modify: `apps/admin/components/settings-page.tsx` — strip venue section, keep org-only
- Modify: `apps/admin/lib/convex-api.ts` — add `getBySlugFull` type

---

### Task 1: Backend — Add `getBySlugFull` query

**Files:**
- Modify: `packages/convex/src/queries/venues.ts`
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Add `getBySlugFull` to venues queries**

In `packages/convex/src/queries/venues.ts`, add after the existing `getBySlug` export (line 43):

```typescript
export const getBySlugFull = query({
  args: { orgId: v.id("organizations"), slug: v.string() },
  handler: async (ctx, args): Promise<Venue | null> => {
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_orgId_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
    if (!venue || venue.status !== "active") return null;
    return {
      _id: venue._id, _creationTime: venue._creationTime, orgId: venue.orgId,
      name: venue.name, slug: venue.slug, timezone: venue.timezone,
      capacity: venue.capacity, dayStart: venue.dayStart, dayEnd: venue.dayEnd,
      status: venue.status,
    };
  },
});
```

- [ ] **Step 2: Add `getBySlugFull` to `convex-api.ts`**

In `apps/admin/lib/convex-api.ts`, inside the `queries.venues` object (after the `get` entry at line 50), add:

```typescript
      getBySlugFull: FunctionReference<"query", "public", { orgId: string; slug: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        status: "active" | "archived";
      } | null>;
```

- [ ] **Step 3: Run codegen and typecheck**

```bash
cd packages/convex && pnpm dlx convex codegen
pnpm --filter @openschedule/convex typecheck
pnpm --filter admin typecheck
```

Expected: only the 2 known pre-existing errors (`auth.ts:14`, `triggers.ts:3`).

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/queries/venues.ts apps/admin/lib/convex-api.ts
git commit -m "feat(convex): add getBySlugFull venue query for admin"
```

---

### Task 2: Restructure routes — Org-level pages

**Files:**
- Create: `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/(dashboard)/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/team/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/settings/page.tsx`

This task creates the org-level route shell. The old `(tabs)/` directory is NOT deleted yet (Task 5 handles cleanup after venue routes work).

- [ ] **Step 1: Create org dashboard layout**

Create `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx`:

```tsx
import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create org dashboard page**

Create `apps/admin/app/(protected)/[orgSlug]/(dashboard)/page.tsx`:

```tsx
import { use } from "react";
import { OrgDashboardPage } from "@/components/org-dashboard-page";

export default function DashboardRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <OrgDashboardPage orgSlug={orgSlug} />;
}
```

- [ ] **Step 3: Create OrgNav component**

Create `apps/admin/components/org-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Users, Settings } from "lucide-react";

export function OrgNav() {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.role === "owner";

  if (!isOwner) return null;

  const links = [
    { label: "Team", href: `/${orgSlug}/team`, icon: Users },
    { label: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];

  return (
    <nav className="flex items-center gap-4 border-b px-4 py-2">
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Create team page**

Create `apps/admin/app/(protected)/[orgSlug]/team/page.tsx`:

```tsx
import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";
import { TeamSection } from "@/components/team-section";

export default function TeamRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1 p-4">
        <TeamSection />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create org settings page**

Create `apps/admin/app/(protected)/[orgSlug]/settings/page.tsx`:

```tsx
import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { OrgNav } from "@/components/org-nav";
import { OrgSettingsWrapper } from "@/components/org-settings-wrapper";

export default function OrgSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <OrgNav />
      <main className="flex-1 p-4">
        <OrgSettingsWrapper orgSlug={orgSlug} />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Create OrgSettingsWrapper component**

Create `apps/admin/components/org-settings-wrapper.tsx`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { OrgSettingsForm } from "./org-settings-form";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";

interface OrgSettingsWrapperProps {
  orgSlug: string;
}

export function OrgSettingsWrapper({ orgSlug }: OrgSettingsWrapperProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <OrgSettingsForm orgId={org._id} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {session?.user?.name ?? "Unknown"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {session?.user?.email ?? "Unknown"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors. Components `OrgDashboardPage` and `TopBar` are not yet updated but the route files reference them, so typecheck may flag `OrgDashboardPage` as missing — that's expected, resolved in Task 3.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/app/(protected)/[orgSlug]/(dashboard) apps/admin/app/(protected)/[orgSlug]/team apps/admin/app/(protected)/[orgSlug]/settings apps/admin/components/org-settings-wrapper.tsx apps/admin/components/org-nav.tsx
git commit -m "feat(admin): add org-level route structure (dashboard, team, settings)"
```

---

### Task 3: Org Dashboard Component

**Files:**
- Create: `apps/admin/components/org-dashboard-page.tsx`
- Create: `apps/admin/components/venue-card.tsx`

- [ ] **Step 1: Create VenueCard component**

Create `apps/admin/components/venue-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";

interface VenueCardProps {
  venue: {
    _id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  orgSlug: string;
}

export function VenueCard({ venue, orgSlug }: VenueCardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    { venueId: venue._id, date: today },
  );

  const pending = bookings?.filter((b) => b.status === "pending").length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === "confirmed").length ?? 0;

  return (
    <Link href={`/${orgSlug}/venues/${venue.slug}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{venue.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{venue.timezone}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              {confirmed} confirmed
            </Badge>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {pending} pending
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Create OrgDashboardPage component**

Create `apps/admin/components/org-dashboard-page.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { VenueCard } from "./venue-card";
import { CreateVenueCard } from "./create-venue-card";
import { TimeGrid } from "./time-grid";
import { BookingDetailModal } from "./booking-detail-modal";
import { Badge } from "@openschedule/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface OrgDashboardPageProps {
  orgSlug: string;
}

export function OrgDashboardPage({ orgSlug }: OrgDashboardPageProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>("all");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const today = format(new Date(), "yyyy-MM-dd");

  // Fetch bookings for all venues today
  const firstVenue = venues?.[0] ?? null;
  const secondVenue = venues?.[1] ?? null;
  const thirdVenue = venues?.[2] ?? null;

  const bookingsFirst = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    firstVenue ? { venueId: firstVenue._id, date: today } : "skip",
  );
  const bookingsSecond = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    secondVenue ? { venueId: secondVenue._id, date: today } : "skip",
  );
  const bookingsThird = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    thirdVenue ? { venueId: thirdVenue._id, date: today } : "skip",
  );

  const allBookings = useMemo(() => {
    const combined = [
      ...(bookingsFirst ?? []),
      ...(bookingsSecond ?? []),
      ...(bookingsThird ?? []),
    ];
    if (venueFilter === "all") return combined;
    return combined.filter((b) => b.venueId === venueFilter);
  }, [bookingsFirst, bookingsSecond, bookingsThird, venueFilter]);

  const isOwner = currentUser?.role === "owner";

  if (!org || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div className="space-y-6 p-4">
        <h2 className="text-lg font-semibold">Welcome to {org.name}</h2>
        <p className="text-muted-foreground">Create your first venue to get started.</p>
        {isOwner && <CreateVenueCard orgId={org._id} />}
      </div>
    );
  }

  // Use the first venue's hours for the aggregated grid (best-effort)
  const gridVenue = firstVenue;
  const activeBookings = allBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="space-y-6 p-4">
      {/* Venue cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Venues</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue._id} venue={venue} orgSlug={orgSlug} />
          ))}
          {isOwner && <CreateVenueCard orgId={org._id} />}
        </div>
      </div>

      {/* Aggregated today */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Today</h2>
          {venues.length > 1 && (
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="secondary">{activeBookings.length} bookings</Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {confirmedCount} confirmed
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {pendingCount} pending
          </Badge>
        </div>

        {gridVenue && (
          <TimeGrid
            bookings={allBookings}
            dayStart={gridVenue.dayStart}
            dayEnd={gridVenue.dayEnd}
            onBookingTap={setSelectedBookingId}
          />
        )}
      </div>

      {selectedBookingId && firstVenue && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={firstVenue._id}
          readOnly={false}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Extract CreateVenueCard from settings-page.tsx**

Create `apps/admin/components/create-venue-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";
import { Plus } from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CreateVenueCardProps {
  orgId: string;
}

export function CreateVenueCard({ orgId }: CreateVenueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("17:00");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVenue = useMutation(convexApi.mutations.venues.create);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      await createVenue({
        orgId: orgId as any,
        name,
        slug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
      });
      setIsExpanded(false);
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setIsCreating(false);
    }
  }

  if (!isExpanded) {
    return (
      <Card
        className="flex cursor-pointer items-center justify-center border-dashed transition-colors hover:bg-muted/50"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <Plus className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Add Venue</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="create-venue-name">Name</Label>
            <Input
              id="create-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Location name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-slug">Slug</Label>
            <Input
              id="create-venue-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="location-name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="create-venue-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-cap">Capacity</Label>
            <Input
              id="create-venue-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="create-venue-start">Day Start</Label>
              <Input id="create-venue-start" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-venue-end">Day End</Label>
              <Input id="create-venue-end" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/org-dashboard-page.tsx apps/admin/components/venue-card.tsx apps/admin/components/create-venue-card.tsx
git commit -m "feat(admin): add org dashboard with venue cards and aggregated today grid"
```

---

### Task 4: Venue-scoped routes and updated TabBar

**Files:**
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/bookings/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/schedule/page.tsx`
- Create: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx`
- Create: `apps/admin/components/venue-settings-page.tsx`
- Modify: `apps/admin/components/tab-bar.tsx`

- [ ] **Step 1: Update TabBar to be venue-aware**

Replace the entire content of `apps/admin/components/tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
    },
  ];
}

export function TabBar() {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background">
      <ul className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Create venue tabs layout**

Create `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx`:

```tsx
import { TopBar } from "@/components/top-bar";
import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1 pb-16">{children}</main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Create venue today page**

Create `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`:

```tsx
import { use } from "react";
import { TodayPage } from "@/components/today-page";

export default function VenueTodayRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <TodayPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
```

- [ ] **Step 4: Create venue bookings page**

Create `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/bookings/page.tsx`:

```tsx
import { use } from "react";
import { BookingsPage } from "@/components/bookings-page";

export default function VenueBookingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <BookingsPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
```

- [ ] **Step 5: Create venue schedule page**

Create `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/schedule/page.tsx`:

```tsx
import { use } from "react";
import { SchedulePage } from "@/components/schedule-page";

export default function VenueScheduleRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <SchedulePage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
```

- [ ] **Step 6: Create VenueSettingsPage component**

Create `apps/admin/components/venue-settings-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface VenueSettingsPageProps {
  orgSlug: string;
  venueSlug: string;
}

export function VenueSettingsPage({ orgSlug, venueSlug }: VenueSettingsPageProps) {
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const [venueName, setVenueName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateVenue = useMutation(convexApi.mutations.venues.update);
  const archiveVenue = useMutation(convexApi.mutations.venues.archive);

  const isOwner = currentUser?.role === "owner";

  // Initialize form values when venue data arrives
  if (venue && !isInitialized) {
    setVenueName(venue.name);
    setTimezone(venue.timezone);
    setCapacity(venue.capacity);
    setDayStart(venue.dayStart);
    setDayEnd(venue.dayEnd);
    setIsInitialized(true);
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Only owners can manage venue settings.</p>
      </div>
    );
  }

  async function handleSave() {
    if (!venue) return;
    setIsSaving(true);
    try {
      await updateVenue({
        id: venue._id,
        name: venueName,
        timezone,
        capacity,
        dayStart,
        dayEnd,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!venue) return;
    if (!confirm("Archive this venue? All future bookings will be cancelled.")) return;
    await archiveVenue({ id: venue._id });
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Venue Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="venue-name">Name</Label>
            <Input
              id="venue-name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Slug</Label>
            <Input value={venue.slug} disabled />
          </div>

          <div className="space-y-1">
            <Label htmlFor="venue-tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="venue-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="venue-capacity">Capacity</Label>
            <Input
              id="venue-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="venue-start">Day Start</Label>
              <Input
                id="venue-start"
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="venue-end">Day End</Label>
              <Input
                id="venue-end"
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="destructive" size="sm" className="ml-auto" onClick={handleArchive}>
              Archive Venue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Create venue settings route page**

Create `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx`:

```tsx
import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1">
        <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin/app/(protected)/[orgSlug]/venues apps/admin/components/tab-bar.tsx apps/admin/components/venue-settings-page.tsx
git commit -m "feat(admin): add venue-scoped routes with tabbar and settings"
```

---

### Task 5: Update page components to resolve venue by slug

**Files:**
- Modify: `apps/admin/components/today-page.tsx`
- Modify: `apps/admin/components/bookings-page.tsx`
- Modify: `apps/admin/components/schedule-page.tsx`

These components currently accept only `orgSlug` and do `venues?.[0]`. Update them to accept `venueSlug` and resolve the venue via `getBySlugFull`.

- [ ] **Step 1: Update TodayPage**

In `apps/admin/components/today-page.tsx`:

Change the interface and venue resolution (replace lines 14-30):

```tsx
interface TodayPageProps {
  orgSlug: string;
  venueSlug: string;
}

export function TodayPage({ orgSlug, venueSlug }: TodayPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );
```

Remove the old `venues` query and `const venue = venues?.[0] ?? null;` line.

Update the loading check (replace the `org === undefined || venues === undefined` block):

```tsx
  if (org === undefined || venue === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Venue not found.</p>
      </div>
    );
  }
```

Also update the `Fab` component to pass `venueId={venue._id}` (it already does, no change needed there).

- [ ] **Step 2: Update BookingsPage**

In `apps/admin/components/bookings-page.tsx`:

Change the interface (line 13-15):

```tsx
interface BookingsPageProps {
  orgSlug: string;
  venueSlug: string;
}
```

Change the function signature and venue resolution (replace lines 18-35):

```tsx
export function BookingsPage({ orgSlug, venueSlug }: BookingsPageProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [therapistFilter, setTherapistFilter] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );
```

Remove the old `venues` query and `const venue = venues?.[0] ?? null;`.

Update the loading guard (replace `if (!org || !venue)` block):

```tsx
  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
```

This stays the same — `venue` is now null when `getBySlugFull` returns null or is still loading.

- [ ] **Step 3: Update SchedulePage**

In `apps/admin/components/schedule-page.tsx`:

Change the interface (line 20-22):

```tsx
interface SchedulePageProps {
  orgSlug: string;
  venueSlug: string;
}
```

Change the function signature and venue resolution (replace lines 24-37):

```tsx
export function SchedulePage({ orgSlug, venueSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBlockoutForm, setShowBlockoutForm] = useState(false);
  const [editingBlockoutId, setEditingBlockoutId] = useState<string | null>(null);
  const [blockoutTherapistFilter, setBlockoutTherapistFilter] = useState<string | null>(null);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );
```

Remove the old `venues` query and `const venue = venues?.[0] ?? null;` line.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors. The old `(tabs)/` routes still exist and reference the old interface (one-prop `orgSlug`) — that will cause errors. If so, update them temporarily to pass a placeholder `venueSlug=""` OR proceed to Task 6 which removes them. If blocking, skip typecheck here and verify after Task 6.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/today-page.tsx apps/admin/components/bookings-page.tsx apps/admin/components/schedule-page.tsx
git commit -m "refactor(admin): resolve venue by slug in page components"
```

---

### Task 6: TopBar with breadcrumb and venue switcher

**Files:**
- Create: `apps/admin/components/venue-switcher.tsx`
- Modify: `apps/admin/components/top-bar.tsx`

- [ ] **Step 1: Create VenueSwitcher component**

Create `apps/admin/components/venue-switcher.tsx`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useParams } from "next/navigation";
import { convexApi } from "@/lib/convex-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface VenueSwitcherProps {
  orgId: string;
  orgSlug: string;
  currentVenueName: string;
}

export function VenueSwitcher({ orgId, orgSlug, currentVenueName }: VenueSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ venueSlug: string }>();
  const currentVenueSlug = params.venueSlug;

  const venues = useQuery(convexApi.queries.venues.listByOrg, { orgId });

  if (!venues || venues.length <= 1) {
    return <span className="text-sm font-medium">{currentVenueName}</span>;
  }

  function handleSwitch(targetSlug: string) {
    // Replace the current venueSlug in the path with the target
    const newPath = pathname.replace(
      `/${orgSlug}/venues/${currentVenueSlug}`,
      `/${orgSlug}/venues/${targetSlug}`,
    );
    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80">
        {currentVenueName}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {venues.map((venue) => (
          <DropdownMenuItem
            key={venue._id}
            onClick={() => handleSwitch(venue.slug)}
            className={venue.slug === currentVenueSlug ? "font-semibold" : ""}
          >
            {venue.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Update TopBar with breadcrumb**

Replace the entire content of `apps/admin/components/top-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import { VenueSwitcher } from "./venue-switcher";
import { ChevronRight } from "lucide-react";

export function TopBar() {
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-1.5">
        <Link href={`/${orgSlug}`} className="text-sm font-semibold hover:text-foreground/80">
          {orgName}
        </Link>
        {venue && venueSlug && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <VenueSwitcher
              orgId={org?._id ?? ""}
              orgSlug={orgSlug}
              currentVenueName={venue.name}
            />
          </>
        )}
      </div>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </header>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors. Check that `DropdownMenu` components are available from `@openschedule/ui`. If not, run `pnpm dlx shadcn add dropdown-menu` from the `packages/ui` directory first.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/top-bar.tsx apps/admin/components/venue-switcher.tsx
git commit -m "feat(admin): add breadcrumb nav with venue switcher dropdown"
```

---

### Task 7: Remove old flat (tabs) routes and clean up settings-page

**Files:**
- Delete: `apps/admin/app/(protected)/[orgSlug]/(tabs)/` (entire directory)
- Modify: `apps/admin/components/settings-page.tsx` — delete (replaced by `org-settings-wrapper.tsx` + `venue-settings-page.tsx`)

- [ ] **Step 1: Delete old (tabs) directory**

```bash
rm -rf apps/admin/app/\(protected\)/\[orgSlug\]/\(tabs\)
```

- [ ] **Step 2: Delete settings-page.tsx**

```bash
rm apps/admin/components/settings-page.tsx
```

The settings functionality is now split:
- Org settings → `org-settings-wrapper.tsx` (created in Task 2) uses `org-settings-form.tsx`
- Venue settings → `venue-settings-page.tsx` (created in Task 4)
- Team → standalone at `/team` route (created in Task 2)
- Create venue → `create-venue-card.tsx` (created in Task 3, used on dashboard)
- Account/sign-out → in `org-settings-wrapper.tsx`

- [ ] **Step 3: Remove any remaining imports of deleted files**

Check for imports of `SettingsPage` from `@/components/settings-page` — these should only have existed in the now-deleted `(tabs)/settings/page.tsx`. Verify no other file references it:

```bash
grep -r "settings-page" apps/admin/ --include="*.tsx" --include="*.ts"
```

If any remain, remove the imports.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors. All routes now point to the new structure.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): remove old flat tab routes, split settings into org/venue"
```

---

### Task 8: Root redirect update and final verification

**Files:**
- Modify: `apps/admin/app/page.tsx` — ensure root redirect lands on `/:orgSlug` (dashboard) not a venue tab

- [ ] **Step 1: Verify root redirect**

Read `apps/admin/app/page.tsx`. It currently redirects to `/${activeOrg.slug}` which will now land on the org dashboard (the `(dashboard)/page.tsx` route). This is correct — no change needed.

If for some reason the redirect goes to a tab (like `/${slug}/bookings`), update it to just `/${slug}`.

- [ ] **Step 2: Full typecheck**

```bash
pnpm --filter @openschedule/convex typecheck
pnpm --filter admin typecheck
```

Expected: only 2 pre-existing errors each.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: no new errors in files touched by this branch. Pre-existing lint warnings/errors in untouched files are acceptable.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @openschedule/convex test
```

Expected: 44/44 pass (no backend changes except the new query, which needs no test since it's a trivial slug lookup mirroring the existing `getBySlug`).

- [ ] **Step 5: E2E verification with agent-browser**

Open admin at `http://localhost:3001`. Verify:
1. Login lands on `/:orgSlug` — shows venue cards + aggregated today
2. Click a venue card → navigates to `/:orgSlug/venues/:venueSlug` — shows venue today view with tab bar
3. Tab bar links work (Bookings, Schedule, Settings tabs)
4. Venue settings page loads with correct venue data
5. Breadcrumb shows `Org > Venue` — clicking org name returns to dashboard
6. If 2+ venues exist: venue switcher dropdown works, preserves current tab

- [ ] **Step 6: Commit any fixes**

If E2E reveals issues, fix and commit with appropriate message.

- [ ] **Step 7: Final commit**

If everything passes without fixes:

```bash
echo "All gates pass — multi-venue admin complete"
```

---

## Verification Commands

| Check | Command | Pass criteria |
|-------|---------|---------------|
| Convex typecheck | `pnpm --filter @openschedule/convex typecheck` | Only 2 pre-existing errors |
| Admin typecheck | `pnpm --filter admin typecheck` | Only 2 pre-existing errors |
| Lint | `pnpm lint` | No new errors in touched files |
| Tests | `pnpm --filter @openschedule/convex test` | 44/44 pass |
| Codegen | `cd packages/convex && pnpm dlx convex codegen` | Clean exit |

## Key Context for Implementers

- **Next.js 16:** Route params are `Promise<{...}>` — unwrap with `use(params)` in server components or `useParams()` in client components.
- **AGENTS.md rules:** No `!` non-null assertions. pnpm only. Semantic commits. Never start dev servers.
- **`_generated/` is gitignored** — only commit source files; run codegen locally.
- **Typecheck baseline:** 2 known errors (`auth.ts:14 authComponent`, `triggers.ts:3 onCreate`) — these are permanent until `convex dev` runs.
- **`convex-api.ts`** is the admin's typed API map — must stay in sync with actual Convex exports.
- **Existing `listByOrg`** already returns full `Venue` docs — `getBySlugFull` is the single-venue equivalent for slug-based lookup.
