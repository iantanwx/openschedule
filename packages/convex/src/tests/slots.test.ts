import { describe, expect, test } from "vitest";
import { computeAvailableSlots } from "../lib/slots";

describe("computeAvailableSlots", () => {
  const baseSchedule = {
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60,
  };

  test("generates slots for a working day with no conflicts", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"], // Monday
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(8); // 09:00-17:00, 60min slots
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result["2025-06-16"]![7]).toEqual({
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  test("returns empty array for non-working days", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
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
      dates: ["2025-06-16"], // Monday
      blockouts: [{ date: "2025-06-16", startTime: "10:00", endTime: "12:00" }],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    // 09:00-10:00 OK, 10:00-11:00 blocked, 11:00-12:00 blocked, 12:00+ OK
    expect(result["2025-06-16"]).toHaveLength(6);
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
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "confirmed" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(7);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("ignores cancelled bookings", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [
        { date: "2025-06-16", startTime: "09:00", endTime: "10:00", status: "cancelled" },
      ],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(8);
  });

  test("removes slots when venue is at capacity", () => {
    const result = computeAvailableSlots({
      schedule: baseSchedule,
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

    // 09:00-10:00 is at capacity (2 bookings, 2 beds), rest are free
    expect(result["2025-06-16"]).toHaveLength(7);
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  test("handles 30-minute slot durations", () => {
    const result = computeAvailableSlots({
      schedule: { ...baseSchedule, slotDuration: 30 },
      dates: ["2025-06-16"],
      blockouts: [],
      bookings: [],
      venueCapacity: 3,
      allBookingsForVenueByDate: {},
    });

    expect(result["2025-06-16"]).toHaveLength(16); // 8 hours * 2 slots/hour
    expect(result["2025-06-16"]![0]).toEqual({
      startTime: "09:00",
      endTime: "09:30",
    });
  });
});
