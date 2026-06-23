export interface CalendarUrlData {
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string;
  description?: string;
}

/**
 * Builds a Google Calendar "Add Event" URL.
 * Dates should be in compact format: "20250623T090000" (no separators).
 */
export function buildGoogleCalendarUrl(data: CalendarUrlData): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", data.title);
  params.set("dates", `${data.startDate}/${data.endDate}`);
  params.set("ctz", data.timezone);

  if (data.location) {
    params.set("location", data.location);
  }

  if (data.description) {
    params.set("details", data.description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
