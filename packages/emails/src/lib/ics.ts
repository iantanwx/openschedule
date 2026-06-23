export interface IcsEventData {
  summary: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string;
  description?: string;
  organizer?: string;
}

/**
 * Generates a valid RFC 5545 VCALENDAR string with a single VEVENT.
 * The dates should be ISO format without timezone suffix (e.g. "2025-06-23T09:00:00").
 * The timezone is specified via the TZID parameter.
 */
export function generateIcs(data: IcsEventData): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}@openschedule`;
  const now = formatIcsDate(new Date().toISOString().slice(0, 19));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenSchedule//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}Z`,
    `DTSTART;TZID=${data.timezone}:${formatIcsDate(data.startDate)}`,
    `DTEND;TZID=${data.timezone}:${formatIcsDate(data.endDate)}`,
    `SUMMARY:${escapeIcsText(data.summary)}`,
  ];

  if (data.location) {
    lines.push(`LOCATION:${escapeIcsText(data.location)}`);
  }

  if (data.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(data.description)}`);
  }

  if (data.organizer) {
    lines.push(`ORGANIZER:mailto:${data.organizer}`);
  }

  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Converts an ISO-ish date string to iCalendar format: "20250623T090000"
 */
function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/[-:]/g, "").replace(/\.\d+/, "");
}

/**
 * Escapes text for iCalendar values (RFC 5545 §3.3.11)
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
