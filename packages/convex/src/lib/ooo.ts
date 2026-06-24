/**
 * OoO (Out of Office) expansion helper.
 * Expands a multi-day OoO record into per-day BlockoutForSlots entries.
 */

interface OooRecord {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

interface BlockoutForSlots {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Given an OoO record and an array of dates (the availability window),
 * returns per-day blockout entries for each date that falls within the OoO range.
 *
 * Rules:
 * - Same day (startDate === endDate): startTime → endTime
 * - First day: startTime → 23:59
 * - Interior days: 00:00 → 23:59
 * - Last day: 00:00 → endTime
 */
export function expandOooToDateRanges(
  ooo: OooRecord,
  dates: string[],
): BlockoutForSlots[] {
  const results: BlockoutForSlots[] = [];

  for (const date of dates) {
    // Skip dates outside the OoO range
    if (date < ooo.startDate || date > ooo.endDate) {
      continue;
    }

    if (ooo.startDate === ooo.endDate) {
      // Same-day OoO
      results.push({ date, startTime: ooo.startTime, endTime: ooo.endTime });
    } else if (date === ooo.startDate) {
      // First day
      results.push({ date, startTime: ooo.startTime, endTime: "23:59" });
    } else if (date === ooo.endDate) {
      // Last day
      results.push({ date, startTime: "00:00", endTime: ooo.endTime });
    } else {
      // Interior day
      results.push({ date, startTime: "00:00", endTime: "23:59" });
    }
  }

  return results;
}
