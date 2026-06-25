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
