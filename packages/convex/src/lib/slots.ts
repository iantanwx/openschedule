import { timeToMinutes, minutesToTime, getDayOfWeek, timeRangesOverlap } from "./time";

// Internal types — these are not Doc-derived because the function is pure and testable
// without Convex. The caller maps Doc fields to these shapes.
interface ScheduleForSlots {
  workingDays: number[];
  startTime: string;
  endTime: string;
}

interface BlockoutForSlots {
  date: string;
  startTime: string;
  endTime: string;
}

interface BookingForSlots {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface VenueBookingSlot {
  startTime: string;
  endTime: string;
}

/** Computed output — not a Doc derivative, it's a result shape */
export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface ComputeSlotsInput {
  schedule: ScheduleForSlots;
  serviceDuration: number;
  dates: string[];
  blockouts: BlockoutForSlots[];
  bookings: BookingForSlots[];
  venueCapacity: number;
  /** All active bookings (any therapist) at the venue, grouped by date — for capacity check */
  allBookingsForVenueByDate: Record<string, VenueBookingSlot[]>;
  /** Today's date in venue timezone (YYYY-MM-DD) — used to filter past slots */
  todayDate?: string;
  /** Current time in venue timezone (HH:MM) — slots before this on todayDate are excluded */
  nowTime?: string;
}

/**
 * Compute available slots for a therapist over a date range.
 *
 * Algorithm per date:
 * 1. If not a working day → empty
 * 2. Generate candidate slots from schedule template
 * 3. Remove slots overlapping blockouts
 * 4. Remove slots overlapping active (pending/confirmed) bookings for this therapist
 * 5. Remove slots where venue is at capacity
 */
export function computeAvailableSlots(
  input: ComputeSlotsInput,
): Record<string, TimeSlot[]> {
  const { schedule, serviceDuration, dates, blockouts, bookings, venueCapacity, allBookingsForVenueByDate, todayDate, nowTime } = input;
  const result: Record<string, TimeSlot[]> = {};
  const nowMinutes = nowTime ? timeToMinutes(nowTime) : null;

  for (const date of dates) {
    const dayOfWeek = getDayOfWeek(date);

    // Step 1: Not a working day
    if (!schedule.workingDays.includes(dayOfWeek)) {
      result[date] = [];
      continue;
    }

    // Step 2: Generate candidate slots
    const candidates = generateCandidateSlots(
      schedule.startTime,
      schedule.endTime,
      serviceDuration,
    );

    // Step 3: Filter out blockouts for this date
    const dateBlockouts = blockouts.filter((b) => b.date === date);

    // Step 4: Filter out active bookings for this therapist on this date
    const dateBookings = bookings.filter(
      (b) => b.date === date && b.status !== "cancelled",
    );

    // Step 5: Get venue-wide bookings for capacity check
    const venueBookingsForDate = allBookingsForVenueByDate[date] ?? [];

    const available = candidates.filter((slot) => {
      // Filter out past slots for today
      if (todayDate && date === todayDate && nowMinutes !== null) {
        if (timeToMinutes(slot.startTime) < nowMinutes) {
          return false;
        }
      }

      // Check blockout overlap
      for (const blockout of dateBlockouts) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, blockout.startTime, blockout.endTime)) {
          return false;
        }
      }

      // Check therapist booking overlap
      for (const booking of dateBookings) {
        if (timeRangesOverlap(slot.startTime, slot.endTime, booking.startTime, booking.endTime)) {
          return false;
        }
      }

      // Check venue capacity
      const overlappingVenueBookings = venueBookingsForDate.filter((vb) =>
        timeRangesOverlap(slot.startTime, slot.endTime, vb.startTime, vb.endTime),
      );
      if (overlappingVenueBookings.length >= venueCapacity) {
        return false;
      }

      return true;
    });

    result[date] = available;
  }

  return result;
}

const SLOT_ALIGNMENT = 15; // minutes

function generateCandidateSlots(
  startTime: string,
  endTime: string,
  serviceDuration: number,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  let current = startMin;
  while (current + serviceDuration <= endMin) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + serviceDuration),
    });
    current += SLOT_ALIGNMENT;
  }

  return slots;
}
