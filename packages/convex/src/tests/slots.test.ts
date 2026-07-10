import { describe, expect, test } from "vitest";
import { computeAvailableSlots } from "../lib/slots";

describe("computeAvailableSlots", () => {
  const baseSchedule = {
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: "09:00",
    endTime: "17:00",
  };

  // With 15-min alignment and 60-min service in 8h window:
  // slots start at 09:00, 09:15, ..., 16:00 → (16:00 - 09:00)/15 + 1 = 29 slots
  test("generates slots for a working day with no conflicts", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"], // Monday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(29);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result["2025-06-16"]![28]).toEqual({
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  test("returns empty array for non-working days", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-15"], // Sunday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-15"]).toHaveLength(0);
  });

  test("removes slots that overlap with blockouts", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"], // Monday
      blockouts: [{ date: "2025-06-16", startTime: "10:00", endTime: "12:00" }],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    // Blocked: slots where [start, start+60) overlaps [10:00, 12:00)
    // i.e. start < 12:00 AND start+60 > 10:00 → start >= 09:15 AND start < 12:00
    // Blocked starts: 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 11:45 = 11
    // Available: 29 - 11 = 18
    expect(result["2025-06-16"]).toHaveLength(18);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result["2025-06-16"]![1]).toEqual({
      startTime: "12:00",
      endTime: "13:00",
    });
  });

  test("removes slots that overlap with existing bookings", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "confirmed" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    // Blocked: slots overlapping [09:00, 10:00) → start < 10:00 AND start+60 > 09:00
    // start < 10:00: 09:00, 09:15, 09:30, 09:45 = 4 blocked
    // Available: 29 - 4 = 25
    expect(result["2025-06-16"]).toHaveLength(25);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("ignores cancelled bookings", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "cancelled" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(29);
  });

  test("removes slots when venue is at capacity", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 2,
      allBookingsForVenueByDate: {
        "2025-06-16": [
          { startTime: "09:00", endTime: "10:00" },
          { startTime: "09:00", endTime: "10:00" },
        ],
      },
    });

    // Same overlap logic as bookings: slots starting 09:00-09:45 overlap [09:00, 10:00) = 4 blocked
    // Available: 29 - 4 = 25
    expect(result["2025-06-16"]).toHaveLength(25);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("handles 30-minute slot durations", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 30,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    // 30-min service, 15-min alignment: starts at 09:00, 09:15, ..., 16:30 → (16:30-09:00)/15 + 1 = 31
    expect(result["2025-06-16"]).toHaveLength(31);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "09:30",
    });
  });

  test("filters slots within minAdvanceMinutes on today", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"], // Monday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 90,
    });

    // nowTime=10:00, advance=90min → cutoff=11:30
    // Slots with startTime < 11:30 are excluded
    // First valid slot starts at 11:30
    const slots = result["2025-06-16"]!;
    expect(slots[0]).toEqual({ startTime: "11:30", endTime: "12:30" });
    // From 11:30 to 16:00 at 15-min intervals: (16:00-11:30)/15 + 1 = 19
    expect(slots).toHaveLength(19);
  });

  test("does not filter advance time on future dates", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16", "2025-06-17"], // Mon, Tue
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 90,
    });

    // Tomorrow should have all 29 slots (no advance filtering)
    expect(result["2025-06-17"]).toHaveLength(29);
  });

  test("minAdvanceMinutes=0 falls back to existing past-time filter", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      serviceDuration: 60,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
      todayDate: "2025-06-16",
      nowTime: "10:00",
      minAdvanceMinutes: 0,
    });

    // With minAdvanceMinutes=0, only past slots are filtered (startTime < 10:00)
    // First valid: 10:00. From 10:00 to 16:00 at 15-min = 25 slots
    expect(result["2025-06-16"]![0]).toEqual({ startTime: "10:00", endTime: "11:00" });
    expect(result["2025-06-16"]).toHaveLength(25);
  });
});
