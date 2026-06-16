"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@openschedule/ui/components/button";
import { format, parseISO } from "date-fns";

interface DayNavProps {
  date: string; // "YYYY-MM-DD"
  onPrev: () => void;
  onNext: () => void;
}

export function DayNav({ date, onPrev, onNext }: DayNavProps) {
  const parsed = parseISO(date);
  const display = format(parsed, "EEE, MMM d");

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous day">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-sm font-medium">{display}</span>
      <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next day">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
