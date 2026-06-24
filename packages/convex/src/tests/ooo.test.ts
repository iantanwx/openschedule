import { describe, expect, test } from "vitest";
import { expandOooToDateRanges } from "../lib/ooo";

describe("expandOooToDateRanges", () => {
  test("same-day OoO returns single entry with original times", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-24", endTime: "16:00" },
      ["2025-06-24"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "16:00" },
    ]);
  });

  test("same-day OoO not in dates array returns empty", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-24", endTime: "16:00" },
      ["2025-06-25"],
    );
    expect(result).toEqual([]);
  });

  test("multi-day OoO: first day uses startTime to 23:59", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-24"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
    ]);
  });

  test("multi-day OoO: interior day uses 00:00 to 23:59", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-25"],
    );
    expect(result).toEqual([
      { date: "2025-06-25", startTime: "00:00", endTime: "23:59" },
    ]);
  });

  test("multi-day OoO: last day uses 00:00 to endTime", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-26", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("multi-day OoO: full expansion across all dates", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-26", endTime: "12:00" },
      ["2025-06-24", "2025-06-25", "2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "23:59" },
      { date: "2025-06-26", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("dates outside OoO range are excluded", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "14:00", endDate: "2025-06-25", endTime: "12:00" },
      ["2025-06-23", "2025-06-24", "2025-06-25", "2025-06-26"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "14:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "12:00" },
    ]);
  });

  test("two-day OoO has no interior days", () => {
    const result = expandOooToDateRanges(
      { startDate: "2025-06-24", startTime: "16:00", endDate: "2025-06-25", endTime: "10:00" },
      ["2025-06-24", "2025-06-25"],
    );
    expect(result).toEqual([
      { date: "2025-06-24", startTime: "16:00", endTime: "23:59" },
      { date: "2025-06-25", startTime: "00:00", endTime: "10:00" },
    ]);
  });
});
