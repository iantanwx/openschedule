"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import { Temporal } from "temporal-polyfill";
import { useNextCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
} from "@schedule-x/calendar";
import type { CalendarEvent } from "@schedule-x/calendar";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import "@schedule-x/theme-shadcn/dist/index.css";
import "@/app/schedule-x-overrides.css";

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarPageProps {
  orgSlug: string;
  venueSlug: string;
}

type BookingRecord = {
  _id: string;
  therapistId: string;
  customerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
};

type OooRecord = {
  _id: string;
  therapistId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason?: string;
  status: "active" | "inactive";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_VIEWS: CalendarView[] = ["day", "3day", "week", "month", "schedule"];

function isCalendarView(v: string | null): v is CalendarView {
  return v !== null && (VALID_VIEWS as string[]).includes(v);
}

/** Map our CalendarView to schedule-x view name */
function toSxViewName(view: CalendarView): string {
  switch (view) {
    case "day": return "day";
    case "3day": return "week"; // week view with nDays=3
    case "week": return "week";
    case "month": return "month-grid";
    case "schedule": return "week"; // agenda is custom, but sx stays on week
  }
}

/** Compute the date range to query given the current view and date */
function getDateRange(date: Date, view: CalendarView): { startDate: string; endDate: string } {
  switch (view) {
    case "day":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(date, "yyyy-MM-dd"),
      };
    case "3day":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(addDays(date, 2), "yyyy-MM-dd"),
      };
    case "week":
      return {
        startDate: format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        startDate: format(startOfMonth(date), "yyyy-MM-dd"),
        endDate: format(endOfMonth(date), "yyyy-MM-dd"),
      };
    case "schedule":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(addDays(date, 13), "yyyy-MM-dd"),
      };
  }
}

/** Convert a date string + time string to Temporal.ZonedDateTime */
function toZonedDateTime(date: string, time: string, timezone: string): Temporal.ZonedDateTime {
  return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(timezone);
}

/** Map a booking to a schedule-x CalendarEvent */
function bookingToEvent(
  booking: BookingRecord,
  therapistName: string,
  customerName: string,
  timezone: string,
): CalendarEvent {
  return {
    id: booking._id,
    start: toZonedDateTime(booking.date, booking.startTime, timezone),
    end: toZonedDateTime(booking.date, booking.endTime, timezone),
    title: customerName,
    calendarId: "booking",
    _customContent: {
      type: "booking",
      customerName,
      therapistName,
      status: booking.status,
      startTime: booking.startTime.slice(0, 5),
      endTime: booking.endTime.slice(0, 5),
    },
  };
}

/** Map an OoO entry to a schedule-x CalendarEvent */
function oooToEvent(
  ooo: OooRecord,
  therapistName: string,
  timezone: string,
): CalendarEvent {
  return {
    id: `ooo-${ooo._id}`,
    start: toZonedDateTime(ooo.startDate, ooo.startTime, timezone),
    end: toZonedDateTime(ooo.endDate, ooo.endTime, timezone),
    title: `${therapistName} — OoO`,
    calendarId: "ooo",
    _customContent: {
      type: "ooo",
      therapistName,
      reason: ooo.reason,
    },
  };
}

// ---------------------------------------------------------------------------
// AgendaView (simple list for "schedule" mode)
// ---------------------------------------------------------------------------

interface AgendaViewProps {
  bookings: BookingRecord[];
  therapistMap: Map<string, string>;
  customerMap: Map<string, string>;
  onEventClick: (bookingId: string) => void;
}

function AgendaView({ bookings, therapistMap, customerMap, onEventClick }: AgendaViewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, BookingRecord[]>();
    for (const b of bookings) {
      const existing = map.get(b.date);
      if (existing) {
        existing.push(b);
      } else {
        map.set(b.date, [b]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [bookings]);

  if (grouped.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        No bookings in this range
      </div>
    );
  }

  return (
    <div className="divide-y">
      {grouped.map(([date, dayBookings]) => (
        <div key={date} className="py-3">
          <h3 className="px-4 pb-2 text-sm font-semibold text-muted-foreground">
            {format(parseISO(date), "EEEE, MMM d")}
          </h3>
          <div className="space-y-1 px-4">
            {dayBookings
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((b) => (
                <button
                  key={b._id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/50"
                  onClick={() => onEventClick(b._id)}
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {b.startTime.slice(0, 5)} – {b.endTime.slice(0, 5)}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {customerMap.get(b.customerId) ?? "Customer"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {therapistMap.get(b.therapistId) ?? "Therapist"}
                  </span>
                  <Badge
                    variant={
                      b.status === "confirmed"
                        ? "default"
                        : b.status === "pending"
                          ? "secondary"
                          : "outline"
                    }
                    className="ml-2 text-[10px]"
                  >
                    {b.status}
                  </Badge>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarPage
// ---------------------------------------------------------------------------

export function CalendarPage({ orgSlug, venueSlug }: CalendarPageProps) {
  const { resolvedTheme } = useTheme();

  // Local state for view and date (NOT URL params — avoids Next.js remount)
  const [currentView, setCurrentView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Modal state
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [therapistFilter, setTherapistFilter] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Calendar controls plugin (created once, stable reference)
  // -------------------------------------------------------------------------

  const calendarControlsRef = useRef(createCalendarControlsPlugin());
  const calendarControls = calendarControlsRef.current;

  // -------------------------------------------------------------------------
  // Convex queries
  // -------------------------------------------------------------------------

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const { startDate, endDate } = useMemo(
    () => getDateRange(currentDate, currentView),
    [currentDate, currentView],
  );

  const isSingleDay = currentView === "day";
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

  const primaryTherapistId = currentUser?._id ?? null;
  const oooEntries = useQuery(
    convexApi.queries.ooo.listByTherapistAndDateRange,
    primaryTherapistId ? { therapistId: primaryTherapistId, startDate, endDate } : "skip",
  );

  // -------------------------------------------------------------------------
  // View scope (My/All toggle)
  // -------------------------------------------------------------------------

  const { viewScope, setViewScope, showToggle, showTherapistFilter, isReadOnly, filteredByScope } =
    useViewScope({ currentUser, bookings });

  const displayedBookings = useMemo(() => {
    if (!therapistFilter) return filteredByScope;
    return filteredByScope.filter((b) => b.therapistId === therapistFilter);
  }, [filteredByScope, therapistFilter]);

  // -------------------------------------------------------------------------
  // Name maps
  // -------------------------------------------------------------------------

  const therapistMap = useMemo(() => {
    const map = new Map<string, string>();
    if (therapists) {
      for (const t of therapists) {
        map.set(t._id, t.name);
      }
    }
    return map;
  }, [therapists]);

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    if (displayedBookings) {
      for (const b of displayedBookings) {
        if (!map.has(b.customerId)) {
          map.set(b.customerId, "Customer");
        }
      }
    }
    return map;
  }, [displayedBookings]);

  // -------------------------------------------------------------------------
  // Schedule-x events
  // -------------------------------------------------------------------------

  const timezone = venue?.timezone ?? "UTC";

  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    if (displayedBookings) {
      for (const b of displayedBookings) {
        if (b.status === "cancelled") continue; // don't show cancelled on calendar
        events.push(
          bookingToEvent(
            b,
            therapistMap.get(b.therapistId) ?? "Therapist",
            customerMap.get(b.customerId) ?? "Customer",
            timezone,
          ),
        );
      }
    }

    if (oooEntries) {
      for (const ooo of oooEntries) {
        if (ooo.status !== "active") continue;
        events.push(
          oooToEvent(ooo, therapistMap.get(ooo.therapistId) ?? "Therapist", timezone),
        );
      }
    }

    return events;
  }, [displayedBookings, oooEntries, therapistMap, customerMap, timezone]);

  // -------------------------------------------------------------------------
  // Schedule-x calendar app (created ONCE, never re-created)
  // -------------------------------------------------------------------------

  const calendarApp = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    events: [],
    theme: "shadcn",
    isDark: resolvedTheme === "dark",
    selectedDate: Temporal.PlainDate.from(format(currentDate, "yyyy-MM-dd")),
    defaultView: toSxViewName(currentView),
    calendars: {
      booking: {
        colorName: "booking",
        lightColors: { main: "transparent", container: "transparent", onContainer: "#000" },
        darkColors: { main: "transparent", container: "transparent", onContainer: "#fff" },
      },
      ooo: {
        colorName: "ooo",
        lightColors: { main: "transparent", container: "transparent", onContainer: "#4f46e5" },
        darkColors: { main: "transparent", container: "transparent", onContainer: "#a5b4fc" },
      },
    },
    callbacks: {
      onEventClick(event) {
        const id = String(event.id);
        if (!id.startsWith("ooo-")) {
          setSelectedBookingId(id);
        }
      },
    },
    weekOptions: {
      gridHeight: 800,
      nDays: currentView === "3day" ? 3 : 7,
      eventWidth: 95,
      timeAxisFormatOptions: { hour: "numeric", minute: "2-digit" },
      eventOverlap: true,
      gridStep: 60,
    },
    dayBoundaries: venue
      ? { start: venue.dayStart, end: venue.dayEnd }
      : { start: "07:00", end: "21:00" },
  }, [calendarControls]);

  // -------------------------------------------------------------------------
  // Sync state to calendar app via controls plugin (imperative updates)
  // -------------------------------------------------------------------------

  // Sync events
  useEffect(() => {
    if (calendarApp) {
      calendarApp.events.set(calendarEvents);
    }
  }, [calendarApp, calendarEvents]);

  // Sync view changes
  const prevViewRef = useRef(currentView);
  useEffect(() => {
    if (!calendarApp) return;
    if (prevViewRef.current === currentView) return;
    prevViewRef.current = currentView;

    const sxView = toSxViewName(currentView);
    calendarControls.setView(sxView);

    // Always set date to current selection when switching views
    // This ensures 3-day shows today instead of week start
    calendarControls.setDate(Temporal.PlainDate.from(format(currentDate, "yyyy-MM-dd")));

    // For 3-day vs week, update nDays
    if (currentView === "3day") {
      calendarControls.setWeekOptions({ nDays: 3, gridHeight: 800, eventWidth: 95, timeAxisFormatOptions: { hour: "numeric", minute: "2-digit" }, eventOverlap: true, gridStep: 60 });
    } else if (currentView === "week") {
      calendarControls.setWeekOptions({ nDays: 7, gridHeight: 800, eventWidth: 95, timeAxisFormatOptions: { hour: "numeric", minute: "2-digit" }, eventOverlap: true, gridStep: 60 });
    }
  }, [calendarApp, calendarControls, currentView, currentDate]);

  // Sync date changes
  const prevDateRef = useRef(format(currentDate, "yyyy-MM-dd"));
  useEffect(() => {
    if (!calendarApp) return;
    const dateStr = format(currentDate, "yyyy-MM-dd");
    if (prevDateRef.current === dateStr) return;
    prevDateRef.current = dateStr;
    calendarControls.setDate(Temporal.PlainDate.from(dateStr));
  }, [calendarApp, calendarControls, currentDate]);

  // -------------------------------------------------------------------------
  // Navigation (local state, no URL changes = no remount)
  // -------------------------------------------------------------------------

  const handleViewChange = useCallback(
    (view: CalendarView) => {
      setCurrentView(view);
    },
    [],
  );

  const handleDateChange = useCallback(
    (date: Date) => {
      setCurrentDate(date);
    },
    [],
  );

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // -------------------------------------------------------------------------
  // Stats badges
  // -------------------------------------------------------------------------

  const stats = useMemo(() => {
    if (!displayedBookings) return { total: 0, confirmed: 0, pending: 0 };
    return {
      total: displayedBookings.filter((b) => b.status !== "cancelled").length,
      confirmed: displayedBookings.filter((b) => b.status === "confirmed").length,
      pending: displayedBookings.filter((b) => b.status === "pending").length,
    };
  }, [displayedBookings]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (!venue || !currentUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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

      {/* Sub-toolbar: toggle + filter + stats */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 pb-2">
        {showToggle && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}

        {showTherapistFilter && therapists && (
          <Select
            value={therapistFilter ?? "all"}
            onValueChange={(val) => setTherapistFilter(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All therapists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All therapists</SelectItem>
              {therapists.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Stats badges */}
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {stats.total} total
          </Badge>
          <Badge variant="default" className="text-xs">
            {stats.confirmed} confirmed
          </Badge>
          {stats.pending > 0 && (
            <Badge variant="outline" className="text-xs">
              {stats.pending} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Calendar body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {showScheduleX ? (
          calendarApp ? (
            <ScheduleXCalendar
              calendarApp={calendarApp}
              customComponents={{
                timeGridEvent: CalendarBookingEvent,
                dateGridEvent: CalendarBookingEvent,
                monthGridEvent: CalendarBookingEvent,
              }}
            />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          )
        ) : (
          <AgendaView
            bookings={displayedBookings ?? []}
            therapistMap={therapistMap}
            customerMap={customerMap}
            onEventClick={setSelectedBookingId}
          />
        )}
      </div>

      {/* FAB */}
      <Fab orgSlug={orgSlug} venueId={venue._id} />

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
