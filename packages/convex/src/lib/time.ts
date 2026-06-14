/**
 * Time utilities for slot computation.
 * All time strings are in "HH:MM" 24-hour format.
 * All dates are in "YYYY-MM-DD" ISO format.
 */

import { addDays, getDay, format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/** Convert "HH:MM" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Convert minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Generate an array of dates from startDate for N days (inclusive of startDate) */
export function generateDateRange(startDate: string, days: number): string[] {
  const start = parseISO(startDate);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(format(addDays(start, i), "yyyy-MM-dd"));
  }
  return dates;
}

/** Get the day of week (0=Sun, 6=Sat) for a date string */
export function getDayOfWeek(date: string): number {
  return getDay(parseISO(date));
}

/** Check if two time ranges overlap. Ranges are [start, end) half-open intervals. */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aStartMin = timeToMinutes(aStart);
  const aEndMin = timeToMinutes(aEnd);
  const bStartMin = timeToMinutes(bStart);
  const bEndMin = timeToMinutes(bEnd);
  return aStartMin < bEndMin && bStartMin < aEndMin;
}

/** Get today's date as "YYYY-MM-DD" in a given IANA timezone */
export function todayInTimezone(timezone: string): string {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  return format(zonedNow, "yyyy-MM-dd");
}
