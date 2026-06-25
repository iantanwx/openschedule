"use client";

interface CalendarOooEventProps {
  calendarEvent: {
    id: string;
    title: string;
    start: string;
    end: string;
    _customContent?: {
      therapistName: string;
      reason?: string;
    };
  };
}

export function CalendarOooEvent({ calendarEvent }: CalendarOooEventProps) {
  const content = calendarEvent._customContent;
  if (!content) {
    return <div className="text-xs">{calendarEvent.title}</div>;
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-sm border border-dashed border-indigo-400 bg-indigo-50 px-1.5 py-0.5 dark:border-indigo-500 dark:bg-indigo-950/30">
      <p className="truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {content.therapistName} — OoO
      </p>
      {content.reason && (
        <p className="truncate text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
          {content.reason}
        </p>
      )}
    </div>
  );
}
