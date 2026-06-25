# Calendar Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom single-day time grid with a full @schedule-x/react calendar supporting Day, 3-Day, Week, Month, and Schedule views.

**Architecture:** Install @schedule-x/react, create a CalendarPage component that replaces TodayPage, with a CalendarToolbar for navigation/view switching and custom event renderers for bookings and OoO. URL state drives view+date via search params.

**Tech Stack:** @schedule-x/react, date-fns, Next.js App Router, Convex reactive queries

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/admin/lib/nav/venue-tabs.ts` | Modify | Rename "Today" → "Calendar" |
| `apps/admin/components/tab-bar.tsx` | Modify | Rename "Today" → "Calendar", rename handler |
| `apps/admin/components/calendar-toolbar.tsx` | Create | Navigation arrows, date display, view switcher (segmented/dropdown) |
| `apps/admin/components/calendar-booking-event.tsx` | Create | Custom booking event renderer for schedule-x |
| `apps/admin/components/calendar-ooo-event.tsx` | Create | Custom OoO event renderer for schedule-x |
| `apps/admin/components/calendar-page.tsx` | Create | Main calendar page with schedule-x, URL state, queries, filters |
| `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx` | Modify | Import CalendarPage instead of TodayPage |
| `apps/admin/components/today-page.tsx` | Delete | Replaced by calendar-page |
| `apps/admin/components/time-grid.tsx` | Delete | Replaced by schedule-x |
| `apps/admin/components/day-nav.tsx` | Delete | Replaced by calendar-toolbar |
| `apps/admin/components/booking-block.tsx` | Delete | Replaced by calendar-booking-event |

---

### Task 1: Install @schedule-x/react and rename tab

**Files:**
- Modify: `apps/admin/lib/nav/venue-tabs.ts`
- Modify: `apps/admin/components/tab-bar.tsx`

- [ ] **Step 1: Install schedule-x packages**

Run:
```bash
pnpm --filter admin add @schedule-x/react @schedule-x/theme-default
```

Expected: packages added to `apps/admin/package.json`

- [ ] **Step 2: Rename "Today" to "Calendar" in venue-tabs.ts**

Replace the full file content of `apps/admin/lib/nav/venue-tabs.ts`:

```ts
import { Calendar, List, Clock, Settings } from "lucide-react";
import type { ComponentType } from "react";

export interface VenueTabLink {
  label: string;
  icon: ComponentType<{ className?: string }>;
  ownerOnly: boolean;
  href: (base: string) => string;
  isActive: (pathname: string, base: string) => boolean;
}

export const VENUE_TAB_LINKS: VenueTabLink[] = [
  {
    label: "Calendar",
    icon: Calendar,
    ownerOnly: false,
    href: (base) => base,
    isActive: (pathname, base) => pathname === base || pathname === `${base}/`,
  },
  {
    label: "Bookings",
    icon: List,
    ownerOnly: false,
    href: (base) => `${base}/bookings`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/bookings`),
  },
  {
    label: "Schedule",
    icon: Clock,
    ownerOnly: false,
    href: (base) => `${base}/schedule`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/schedule`),
  },
  {
    label: "Settings",
    icon: Settings,
    ownerOnly: true,
    href: (base) => `${base}/settings`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/settings`),
  },
];

export function getVisibleVenueTabs(isOwner: boolean): VenueTabLink[] {
  return VENUE_TAB_LINKS.filter((tab) => !tab.ownerOnly || isOwner);
}
```

- [ ] **Step 3: Rename "Today" to "Calendar" in tab-bar.tsx**

Replace the full file content of `apps/admin/components/tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Calendar",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b || pathname === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];
}

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  function handleCalendarClick(e: React.MouseEvent, tab: Tab) {
    if (tab.label === "Calendar" && tab.match(pathname, base)) {
      e.preventDefault();
      // Already on Calendar — navigate to base (no params), triggering scroll-to-top + reset
      router.push(base);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background ${className ?? ""}`}>
      <ul className="flex h-16 items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                onClick={(e) => handleCalendarClick(e, tab)}
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

- [ ] **Step 4: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors (auth.ts:15, triggers.ts:3). No new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/package.json pnpm-lock.yaml apps/admin/lib/nav/venue-tabs.ts apps/admin/components/tab-bar.tsx
git commit -m "feat(admin): install schedule-x and rename Today tab to Calendar"
```

---

### Task 2: Create CalendarToolbar component

**Files:**
- Create: `apps/admin/components/calendar-toolbar.tsx`

- [ ] **Step 1: Create the CalendarToolbar component**

Create `apps/admin/components/calendar-toolbar.tsx`:

```tsx
"use client";

import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@openschedule/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";
import { cn } from "@openschedule/ui/lib/utils";

export type CalendarView = "day" | "3day" | "week" | "month" | "schedule";

interface CalendarToolbarProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  "3day": "3-Day",
  week: "Week",
  month: "Month",
  schedule: "Schedule",
};

const VIEWS: CalendarView[] = ["day", "3day", "week", "month", "schedule"];

function formatDateRange(date: Date, view: CalendarView): string {
  switch (view) {
    case "day":
      return format(date, "EEEE, MMM d, yyyy");
    case "3day": {
      const end = addDays(date, 2);
      if (date.getMonth() === end.getMonth()) {
        return `${format(date, "MMM d")} – ${format(end, "d, yyyy")}`;
      }
      return `${format(date, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    case "week": {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`;
      }
      return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }
    case "month":
      return format(date, "MMMM yyyy");
    case "schedule":
      return format(date, "MMM d, yyyy");
  }
}

function formatDateCompact(date: Date, view: CalendarView): string {
  switch (view) {
    case "day":
      return format(date, "MMM d");
    case "3day": {
      const end = addDays(date, 2);
      return `${format(date, "MMM d")} – ${format(end, "d")}`;
    }
    case "week": {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(weekStart, "MMM d")} – ${format(weekEnd, "d")}`;
    }
    case "month":
      return format(date, "MMM yyyy");
    case "schedule":
      return format(date, "MMM d");
  }
}

export function CalendarToolbar({
  currentView,
  onViewChange,
  currentDate,
  onDateChange,
  onToday,
}: CalendarToolbarProps) {
  function handlePrev() {
    switch (currentView) {
      case "day":
        onDateChange(addDays(currentDate, -1));
        break;
      case "3day":
        onDateChange(addDays(currentDate, -3));
        break;
      case "week":
        onDateChange(addDays(currentDate, -7));
        break;
      case "month":
        onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        break;
      case "schedule":
        onDateChange(addDays(currentDate, -7));
        break;
    }
  }

  function handleNext() {
    switch (currentView) {
      case "day":
        onDateChange(addDays(currentDate, 1));
        break;
      case "3day":
        onDateChange(addDays(currentDate, 3));
        break;
      case "week":
        onDateChange(addDays(currentDate, 7));
        break;
      case "month":
        onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        break;
      case "schedule":
        onDateChange(addDays(currentDate, 7));
        break;
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2">
      {/* Left: navigation arrows + date */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={handlePrev} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} className="ml-1">
          Today
        </Button>
        {/* Desktop date label */}
        <span className="ml-2 hidden text-sm font-medium sm:inline">
          {formatDateRange(currentDate, currentView)}
        </span>
        {/* Mobile compact date label */}
        <span className="ml-2 text-sm font-medium sm:hidden">
          {formatDateCompact(currentDate, currentView)}
        </span>
      </div>

      {/* Right: view switcher */}
      {/* Desktop: segmented control */}
      <div className="hidden items-center rounded-lg border bg-muted p-0.5 sm:inline-flex" role="radiogroup" aria-label="Calendar view">
        {VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="radio"
            aria-checked={currentView === view}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              currentView === view
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onViewChange(view)}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      {/* Mobile: select dropdown */}
      <div className="sm:hidden">
        <Select value={currentView} onValueChange={(val) => onViewChange(val as CalendarView)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map((view) => (
              <SelectItem key={view} value={view}>
                {VIEW_LABELS[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors. No new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/calendar-toolbar.tsx
git commit -m "feat(admin): add CalendarToolbar component"
```

---

### Task 3: Create custom event components

**Files:**
- Create: `apps/admin/components/calendar-booking-event.tsx`
- Create: `apps/admin/components/calendar-ooo-event.tsx`

- [ ] **Step 1: Create the booking event renderer**

Create `apps/admin/components/calendar-booking-event.tsx`:

```tsx
"use client";

import { cn } from "@openschedule/ui/lib/utils";

interface CalendarBookingEventProps {
  calendarEvent: {
    id: string;
    title: string;
    start: string;
    end: string;
    _customContent?: {
      customerName: string;
      therapistName: string;
      status: "pending" | "confirmed" | "cancelled";
      startTime: string;
      endTime: string;
    };
  };
}

export function CalendarBookingEvent({ calendarEvent }: CalendarBookingEventProps) {
  const content = calendarEvent._customContent;
  if (!content) {
    return <div className="text-xs">{calendarEvent.title}</div>;
  }

  const statusStyles: Record<string, string> = {
    confirmed: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    pending: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    cancelled: "border-l-muted bg-muted/50 opacity-60",
  };

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded-r-sm border-l-[3px] px-1.5 py-0.5",
        statusStyles[content.status] ?? "border-l-muted bg-muted/50",
      )}
    >
      <p className="truncate text-xs font-medium text-foreground">
        {content.customerName}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {content.therapistName} · {content.startTime}–{content.endTime}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the OoO event renderer**

Create `apps/admin/components/calendar-ooo-event.tsx`:

```tsx
"use client";

interface CalendarOooEventProps {
  calendarEvent: {
    id: string;
    title: string;
    start: string;
    end: string;
    _customContent?: {
      therapistName: string;
      reason?: string;
    };
  };
}

export function CalendarOooEvent({ calendarEvent }: CalendarOooEventProps) {
  const content = calendarEvent._customContent;
  if (!content) {
    return <div className="text-xs">{calendarEvent.title}</div>;
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-sm border border-dashed border-indigo-400 bg-indigo-50 px-1.5 py-0.5 dark:border-indigo-500 dark:bg-indigo-950/30">
      <p className="truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {content.therapistName} — OoO
      </p>
      {content.reason && (
        <p className="truncate text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
          {content.reason}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors. No new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/calendar-booking-event.tsx apps/admin/components/calendar-ooo-event.tsx
git commit -m "feat(admin): add custom calendar event renderers"
```

---

### Task 4: Create CalendarPage component

**Files:**
- Create: `apps/admin/components/calendar-page.tsx`

This is the most complex task. The CalendarPage integrates schedule-x, reads URL state, queries Convex for bookings and OoO, applies role scoping, and renders the full calendar UI.

- [ ] **Step 1: Create the CalendarPage component**

Create `apps/admin/components/calendar-page.tsx`:

```tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ScheduleXCalendar, useCalendarApp } from "@schedule-x/react";
import { createViewDay, createViewWeek, createViewMonthGrid } from "@schedule-x/calendar";
import "@schedule-x/theme-default/dist/index.css";

import { convexApi } from "@/lib/convex-api";
import { useViewScope } from "@/lib/hooks/use-view-scope";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { CalendarBookingEvent } from "./calendar-booking-event";
import { CalendarOooEvent } from "./calendar-ooo-event";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";
import { Badge } from "@openschedule/ui/components/badge";
import { Spinner } from "@openschedule/ui/components/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface CalendarPageProps {
  orgSlug: string;
  venueSlug: string;
}

type ScheduleXEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  calendarId: string;
  _customContent?: Record<string, unknown>;
};

const VALID_VIEWS: CalendarView[] = ["day", "3day", "week", "month", "schedule"];

function isValidView(val: string | null): val is CalendarView {
  if (!val) return false;
  return VALID_VIEWS.includes(val as CalendarView);
}

/**
 * Compute the date range needed for data fetching based on the current view.
 */
function getDateRange(
  date: Date,
  view: CalendarView,
): { startDate: string; endDate: string } {
  switch (view) {
    case "day":
      return { startDate: format(date, "yyyy-MM-dd"), endDate: format(date, "yyyy-MM-dd") };
    case "3day":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(addDays(date, 2), "yyyy-MM-dd"),
      };
    case "week": {
      const ws = startOfWeek(date, { weekStartsOn: 1 });
      const we = endOfWeek(date, { weekStartsOn: 1 });
      return { startDate: format(ws, "yyyy-MM-dd"), endDate: format(we, "yyyy-MM-dd") };
    }
    case "month": {
      const ms = startOfMonth(date);
      const me = endOfMonth(date);
      return { startDate: format(ms, "yyyy-MM-dd"), endDate: format(me, "yyyy-MM-dd") };
    }
    case "schedule":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(addDays(date, 13), "yyyy-MM-dd"),
      };
  }
}

export function CalendarPage({ orgSlug, venueSlug }: CalendarPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- URL state ---
  const viewParam = searchParams.get("view");
  const dateParam = searchParams.get("date");

  const currentView: CalendarView = isValidView(viewParam) ? viewParam : "day";
  const currentDate: Date = dateParam ? parseISO(dateParam) : new Date();

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [therapistFilter, setTherapistFilter] = useState<string | null>(null);

  // --- URL update helper ---
  const updateUrl = useCallback(
    (view: CalendarView, date: Date) => {
      const params = new URLSearchParams();
      params.set("view", view);
      params.set("date", format(date, "yyyy-MM-dd"));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  function handleViewChange(view: CalendarView) {
    updateUrl(view, currentDate);
  }

  function handleDateChange(date: Date) {
    updateUrl(currentView, date);
  }

  function handleToday() {
    updateUrl(currentView, new Date());
  }

  // --- Data queries ---
  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const { startDate, endDate } = getDateRange(currentDate, currentView);
  const isSingleDay = currentView === "day";

  // Use single-day query for day view, range query for multi-day
  const bookingsSingleDay = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    venue && isSingleDay ? { venueId: venue._id, date: startDate } : "skip",
  );

  const bookingsRange = useQuery(
    convexApi.queries.bookings.listByVenueDateRange,
    venue && !isSingleDay ? { venueId: venue._id, startDate, endDate } : "skip",
  );

  const bookings = isSingleDay ? bookingsSingleDay : bookingsRange;

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  // OoO: query for each therapist in the date range
  // We use a single representative therapist query approach —
  // for owners viewing "all", we need OoO from all therapists.
  // Since we can't dynamically call hooks, we query all therapists' OoO
  // by iterating the therapist list in a memo after data arrives.
  // Workaround: query OoO only for the current user's own entries for "my" scope,
  // or skip OoO in the schedule-x view and show it when therapists data is ready.
  //
  // Practical approach: Query OoO for each therapist individually is not feasible
  // with hooks. Instead, we'll use a single "listByTherapistAndDateRange" for the
  // current user (always available), and for "all" scope we show OoO only when
  // a specific therapist is filtered.
  const oooTherapistId = useMemo(() => {
    if (!currentUser) return null;
    // If therapist filter is active, show that therapist's OoO
    if (therapistFilter) return therapistFilter;
    // In "my" scope or if user is a pure therapist, show own OoO
    return currentUser._id;
  }, [currentUser, therapistFilter]);

  const oooEntries = useQuery(
    convexApi.queries.ooo.listByTherapistAndDateRange,
    oooTherapistId ? { therapistId: oooTherapistId, startDate, endDate } : "skip",
  );

  // --- View scope ---
  const { viewScope, setViewScope, showToggle, showTherapistFilter, isReadOnly, filteredByScope } =
    useViewScope({ currentUser, bookings });

  const displayedBookings = useMemo(() => {
    if (!therapistFilter) return filteredByScope;
    return filteredByScope.filter((b) => b.therapistId === therapistFilter);
  }, [filteredByScope, therapistFilter]);

  // --- Build therapist name lookup ---
  const therapistMap = useMemo(() => {
    const map = new Map<string, string>();
    if (therapists) {
      for (const t of therapists) {
        map.set(t._id, t.name);
      }
    }
    return map;
  }, [therapists]);

  // --- Map bookings to schedule-x events ---
  const calendarEvents: ScheduleXEvent[] = useMemo(() => {
    const events: ScheduleXEvent[] = [];

    for (const booking of displayedBookings) {
      if (booking.status === "cancelled") continue;
      // schedule-x expects "YYYY-MM-DD HH:mm" format
      events.push({
        id: booking._id,
        title: therapistMap.get(booking.therapistId) ?? "Booking",
        start: `${booking.date} ${booking.startTime}`,
        end: `${booking.date} ${booking.endTime}`,
        calendarId: "bookings",
        _customContent: {
          customerName: "Client", // We don't have customer name in the list query
          therapistName: therapistMap.get(booking.therapistId) ?? "Unknown",
          status: booking.status,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });
    }

    // Add OoO events
    if (oooEntries) {
      for (const ooo of oooEntries) {
        if (ooo.status !== "active") continue;
        events.push({
          id: `ooo-${ooo._id}`,
          title: `OoO: ${therapistMap.get(ooo.therapistId) ?? "Unknown"}`,
          start: `${ooo.startDate} ${ooo.startTime}`,
          end: `${ooo.endDate} ${ooo.endTime}`,
          calendarId: "ooo",
          _customContent: {
            therapistName: therapistMap.get(ooo.therapistId) ?? "Unknown",
            reason: ooo.reason,
          },
        });
      }
    }

    return events;
  }, [displayedBookings, oooEntries, therapistMap]);

  // --- Schedule-x calendar app ---
  const calendar = useCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    defaultView: currentView === "month" ? "month-grid" : currentView === "week" || currentView === "3day" ? "week" : "day",
    selectedDate: format(currentDate, "yyyy-MM-dd"),
    events: calendarEvents,
    calendars: {
      bookings: {
        colorName: "bookings",
        lightColors: {
          main: "transparent",
          container: "transparent",
          onContainer: "inherit",
        },
        darkColors: {
          main: "transparent",
          container: "transparent",
          onContainer: "inherit",
        },
      },
      ooo: {
        colorName: "ooo",
        lightColors: {
          main: "transparent",
          container: "transparent",
          onContainer: "inherit",
        },
        darkColors: {
          main: "transparent",
          container: "transparent",
          onContainer: "inherit",
        },
      },
    },
    callbacks: {
      onEventClick(calendarEvent) {
        const eventId = String(calendarEvent.id);
        // Only open modal for booking events, not OoO
        if (!eventId.startsWith("ooo-")) {
          setSelectedBookingId(eventId);
        }
      },
    },
  });

  // --- Sync calendar state when URL changes ---
  useEffect(() => {
    if (!calendar) return;

    const sxView =
      currentView === "month"
        ? "month-grid"
        : currentView === "week" || currentView === "3day"
          ? "week"
          : "day";

    calendar.setView(sxView);
    calendar.setDate(format(currentDate, "yyyy-MM-dd"));
  }, [calendar, currentView, currentDate]);

  // --- Sync events reactively ---
  useEffect(() => {
    if (!calendar) return;
    calendar.events.set(calendarEvents);
  }, [calendar, calendarEvents]);

  // --- Loading states ---
  if (org === undefined || venue === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
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

  const activeBookings = displayedBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  // --- Schedule (agenda) view renders a simple list instead of schedule-x ---
  const showScheduleX = currentView !== "schedule";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <CalendarToolbar
        currentView={currentView}
        onViewChange={handleViewChange}
        currentDate={currentDate}
        onDateChange={handleDateChange}
        onToday={handleToday}
      />

      {/* Filters + stats */}
      <div className="flex items-center gap-2 px-4 pb-2">
        {showToggle && <ViewToggle value={viewScope} onChange={setViewScope} />}
        {showTherapistFilter && (
          <Select
            value={therapistFilter ?? "all"}
            onValueChange={(val) => setTherapistFilter(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All therapists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All therapists</SelectItem>
              {(therapists ?? []).map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge variant="secondary">{activeBookings.length} bookings</Badge>
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {confirmedCount} confirmed
        </Badge>
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {pendingCount} pending
        </Badge>
      </div>

      {/* Calendar or Agenda */}
      {showScheduleX ? (
        <div className="flex-1 overflow-auto px-4 pb-20">
          <ScheduleXCalendar
            calendarApp={calendar}
            customComponents={{
              timeGridEvent: ({ calendarEvent }) => {
                const eventId = String(calendarEvent.id);
                if (eventId.startsWith("ooo-")) {
                  return <CalendarOooEvent calendarEvent={calendarEvent as unknown as Parameters<typeof CalendarOooEvent>[0]["calendarEvent"]} />;
                }
                return <CalendarBookingEvent calendarEvent={calendarEvent as unknown as Parameters<typeof CalendarBookingEvent>[0]["calendarEvent"]} />;
              },
              monthGridEvent: ({ calendarEvent }) => {
                const eventId = String(calendarEvent.id);
                if (eventId.startsWith("ooo-")) {
                  return <CalendarOooEvent calendarEvent={calendarEvent as unknown as Parameters<typeof CalendarOooEvent>[0]["calendarEvent"]} />;
                }
                return <CalendarBookingEvent calendarEvent={calendarEvent as unknown as Parameters<typeof CalendarBookingEvent>[0]["calendarEvent"]} />;
              },
            }}
          />
        </div>
      ) : (
        <AgendaView
          bookings={displayedBookings}
          oooEntries={oooEntries ?? []}
          therapistMap={therapistMap}
          onBookingTap={setSelectedBookingId}
        />
      )}

      {/* FAB */}
      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

      {/* Booking detail modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          readOnly={isReadOnly}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}

// --- Agenda (Schedule) View ---

interface AgendaBooking {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  therapistId: string;
  status: "pending" | "confirmed" | "cancelled";
}

interface AgendaOoo {
  _id: string;
  therapistId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason?: string;
  status: "active" | "inactive";
}

interface AgendaViewProps {
  bookings: AgendaBooking[];
  oooEntries: AgendaOoo[];
  therapistMap: Map<string, string>;
  onBookingTap: (id: string) => void;
}

function AgendaView({ bookings, oooEntries, therapistMap, onBookingTap }: AgendaViewProps) {
  // Group bookings by date
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaBooking[]>();
    const active = bookings.filter((b) => b.status !== "cancelled");
    const sorted = [...active].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
    for (const booking of sorted) {
      const existing = map.get(booking.date);
      if (existing) {
        existing.push(booking);
      } else {
        map.set(booking.date, [booking]);
      }
    }
    return map;
  }, [bookings]);

  const dates = Array.from(grouped.keys()).sort();

  if (dates.length === 0 && oooEntries.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No events in this period.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-auto px-4 pb-20">
      {dates.map((date) => {
        const dayBookings = grouped.get(date) ?? [];
        return (
          <div key={date}>
            <h3 className="sticky top-0 bg-background py-1 text-sm font-semibold text-muted-foreground">
              {format(parseISO(date), "EEEE, MMM d")}
            </h3>
            <div className="space-y-1">
              {dayBookings.map((booking) => (
                <button
                  key={booking._id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => onBookingTap(booking._id)}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      booking.status === "confirmed" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {booking.startTime}–{booking.endTime}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {therapistMap.get(booking.therapistId) ?? "Unknown"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* OoO entries */}
      {oooEntries.filter((o) => o.status === "active").length > 0 && (
        <div>
          <h3 className="sticky top-0 bg-background py-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            Out of Office
          </h3>
          <div className="space-y-1">
            {oooEntries
              .filter((o) => o.status === "active")
              .map((ooo) => (
                <div
                  key={ooo._id}
                  className="flex items-center gap-3 rounded-md border border-dashed border-indigo-300 px-3 py-2 dark:border-indigo-600"
                >
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {ooo.startDate} {ooo.startTime} – {ooo.endDate} {ooo.endTime}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {therapistMap.get(ooo.therapistId) ?? "Unknown"}
                    {ooo.reason ? ` · ${ooo.reason}` : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors. No new errors. If schedule-x type issues arise, check that the import paths match the installed package version.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/calendar-page.tsx
git commit -m "feat(admin): add CalendarPage with schedule-x integration"
```

---

### Task 5: Wire CalendarPage into route

**Files:**
- Modify: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`

- [ ] **Step 1: Replace TodayPage import with CalendarPage**

Replace the full file content of `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx`:

```tsx
import { use } from "react";
import { CalendarPage } from "@/components/calendar-page";

export default function VenueCalendarRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return <CalendarPage orgSlug={orgSlug} venueSlug={venueSlug} />;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors. No new errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx"
git commit -m "feat(admin): wire CalendarPage into venue route"
```

---

### Task 6: Delete old components

**Files:**
- Delete: `apps/admin/components/today-page.tsx`
- Delete: `apps/admin/components/time-grid.tsx`
- Delete: `apps/admin/components/day-nav.tsx`
- Delete: `apps/admin/components/booking-block.tsx`

- [ ] **Step 1: Verify no remaining imports of old components**

Run:
```bash
grep -r "today-page\|time-grid\|day-nav\|booking-block" apps/admin/ --include="*.tsx" --include="*.ts" -l
```

Expected: No files should reference these components (the route page.tsx was updated in Task 5). If any files still import them, update those imports first.

- [ ] **Step 2: Delete old files**

Run:
```bash
rm apps/admin/components/today-page.tsx apps/admin/components/time-grid.tsx apps/admin/components/day-nav.tsx apps/admin/components/booking-block.tsx
```

- [ ] **Step 3: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors (auth.ts:15, triggers.ts:3). No new errors from dangling imports.

- [ ] **Step 4: Commit**

```bash
git add -A apps/admin/components/today-page.tsx apps/admin/components/time-grid.tsx apps/admin/components/day-nav.tsx apps/admin/components/booking-block.tsx
git commit -m "chore(admin): remove old custom calendar components"
```

---

### Task 7: Style schedule-x for dark mode

**Files:**
- Create: `apps/admin/styles/schedule-x-overrides.css`
- Modify: `apps/admin/app/layout.tsx` (or root CSS import location)

- [ ] **Step 1: Identify where global CSS is imported**

Run:
```bash
grep -r "globals.css\|global.css" apps/admin/app/ --include="*.tsx" --include="*.ts" -l
```

This tells us where to add the schedule-x CSS import. Typically it's in `apps/admin/app/layout.tsx` or a root `globals.css` file.

- [ ] **Step 2: Create schedule-x dark mode overrides**

Create `apps/admin/styles/schedule-x-overrides.css`:

```css
/*
 * schedule-x dark mode overrides.
 * schedule-x uses CSS custom properties for theming.
 * We override them under .dark to match our app's dark mode.
 */

/* Light mode defaults (match our design tokens) */
.sx-react-calendar-wrapper {
  --sx-color-surface: hsl(var(--background));
  --sx-color-on-surface: hsl(var(--foreground));
  --sx-color-surface-container: hsl(var(--card));
  --sx-color-on-surface-container: hsl(var(--card-foreground));
  --sx-color-primary: hsl(var(--primary));
  --sx-color-on-primary: hsl(var(--primary-foreground));
  --sx-color-outline: hsl(var(--border));
  --sx-color-outline-variant: hsl(var(--border));
  --sx-color-surface-dim: hsl(var(--muted));
  font-family: inherit;
}

/* Dark mode overrides */
.dark .sx-react-calendar-wrapper {
  --sx-color-surface: hsl(var(--background));
  --sx-color-on-surface: hsl(var(--foreground));
  --sx-color-surface-container: hsl(var(--card));
  --sx-color-on-surface-container: hsl(var(--card-foreground));
  --sx-color-primary: hsl(var(--primary));
  --sx-color-on-primary: hsl(var(--primary-foreground));
  --sx-color-outline: hsl(var(--border));
  --sx-color-outline-variant: hsl(var(--border));
  --sx-color-surface-dim: hsl(var(--muted));
}

/* Remove default event background since we use custom renderers */
.sx-react-calendar-wrapper .sx__event {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* Ensure time grid lines are visible in dark mode */
.dark .sx-react-calendar-wrapper .sx__time-grid-day {
  border-color: hsl(var(--border));
}

.dark .sx-react-calendar-wrapper .sx__week-grid__date {
  color: hsl(var(--foreground));
}

/* Current time indicator */
.sx-react-calendar-wrapper .sx__current-time-indicator {
  background-color: hsl(var(--destructive));
}
```

- [ ] **Step 3: Import the override CSS**

If the app uses a `globals.css` file (e.g., `apps/admin/app/globals.css`), add these imports at the top:

```css
@import "@schedule-x/theme-default/dist/index.css";
@import "../styles/schedule-x-overrides.css";
```

Then remove the `@import '@schedule-x/theme-default/dist/index.css'` line from `calendar-page.tsx` (it will be loaded globally instead).

Update `apps/admin/components/calendar-page.tsx` — remove this line:
```tsx
import "@schedule-x/theme-default/dist/index.css";
```

If there is no `globals.css`, add both imports to the root layout CSS file that already exists.

- [ ] **Step 4: Typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors. No new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/styles/schedule-x-overrides.css apps/admin/app/globals.css apps/admin/components/calendar-page.tsx
git commit -m "style(admin): configure schedule-x theme for dark mode"
```

---

### Task 8: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full typecheck**

Run:
```bash
pnpm --filter admin typecheck
```

Expected: Only 2 pre-existing errors (auth.ts:15, triggers.ts:3). Zero new errors.

- [ ] **Step 2: Run Convex tests**

Run:
```bash
pnpm --filter @openschedule/convex test
```

Expected: All tests pass. No regressions from removing old components.

- [ ] **Step 3: Lint touched files**

Run:
```bash
pnpm --filter admin lint -- --no-error-on-unmatched-pattern \
  apps/admin/components/calendar-page.tsx \
  apps/admin/components/calendar-toolbar.tsx \
  apps/admin/components/calendar-booking-event.tsx \
  apps/admin/components/calendar-ooo-event.tsx \
  apps/admin/components/tab-bar.tsx \
  apps/admin/lib/nav/venue-tabs.ts \
  "apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/page.tsx"
```

Expected: No new lint errors. Fix any that appear.

- [ ] **Step 4: Verify URL state behavior manually**

With the dev server running (user must confirm it's up), verify:

1. Navigate to a venue — should load Calendar tab with `?view=day&date=<today>` (or no params = defaults)
2. Click "Week" in the segmented control — URL updates to `?view=week&date=...`
3. Click arrows — date advances/retreats by the correct increment for the view
4. Click "Today" button — resets date to today
5. Hard refresh the page — view and date are preserved from URL params
6. Switch to "Month" view — month grid renders
7. Switch to "Schedule" view — agenda list renders
8. Click a booking in any view — BookingDetailModal opens
9. OoO entries display with indigo dashed style in time grid views
10. My/All toggle and therapist filter continue to work

- [ ] **Step 5: Verify dark mode**

Toggle dark mode (if the app has a theme toggle). Verify:
- Calendar grid lines are visible
- Event cards remain readable
- OoO dashed borders are visible
- No white-on-white or dark-on-dark text issues

---

## Notes for implementers

### schedule-x API caveats

1. **`useCalendarApp` is a hook** — it must be called at the top level of the component. You cannot conditionally create it. The config object is passed once; use `calendar.setView()`, `calendar.setDate()`, and `calendar.events.set()` to update reactively.

2. **Event format** — schedule-x expects `start` and `end` as `"YYYY-MM-DD HH:mm"` strings (space-separated, not ISO `T`). Our booking data stores `date` + `startTime`/`endTime` separately as `"HH:mm"`, so concatenate them: `` `${booking.date} ${booking.startTime}` ``.

3. **3-Day view** — schedule-x does not have a dedicated 3-day view. The plan maps it to the week view (`createViewWeek()`). If schedule-x supports `nDays` config on the week view, use it. Otherwise, the 3-day toolbar navigation (advancing 3 days at a time) still works correctly — the schedule-x week view will show the full week but the date anchor will be correct. Check the schedule-x docs at runtime: if `createViewWeek({ nDays: 3 })` is supported, use it.

4. **Custom event rendering** — use the `customComponents` prop on `ScheduleXCalendar`:
   - `timeGridEvent` — for Day and Week views
   - `monthGridEvent` — for Month grid view
   Both receive `{ calendarEvent }` as props.

5. **Calendar ID** — each event's `calendarId` maps to the `calendars` config. We set both `bookings` and `ooo` to transparent backgrounds so our custom renderers control all styling.

6. **Reactive events** — Convex's `useQuery` returns new arrays on every update. Use `calendar.events.set(calendarEvents)` in a `useEffect` to keep the calendar in sync.

### OoO query limitation

The current approach queries OoO for a single therapist at a time (either the current user or the filtered therapist). This is a constraint of React hooks — we can't call `useQuery` in a loop. For a future improvement, consider adding a `ooo.listByVenueAndDateRange` backend query that returns all OoO entries for all therapists at a venue within a date range. This would allow showing all OoO events when in "All" view scope without a therapist filter.
