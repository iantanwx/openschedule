"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { Button } from "@openschedule/ui/components/button";
import { Separator } from "@openschedule/ui/components/separator";
import { Plus } from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";

interface ScheduleCardProps {
  schedule: {
    _id: string;
    therapistId: string;
    workingDays: number[];
    startTime: string;
    endTime: string;
    availabilityHorizonDays: number;
  };
  onEdit: (scheduleId: string) => void;
  onAddOoo?: (therapistId: string) => void;
  onEditOoo?: (oooId: string, therapistId: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatOooRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const formatTime = (time: string): string => {
    const [h, m] = time.split(":");
    const hour = parseInt(h ?? "0", 10);
    const minute = m ?? "00";
    const suffix = hour >= 12 ? "pm" : "am";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === "00" ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
  };

  if (startDate === endDate) {
    return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${formatTime(endTime)}`;
  }

  return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${format(end, "EEE MMM d")}, ${formatTime(endTime)}`;
}

export function ScheduleCard({ schedule, onEdit, onAddOoo, onEditOoo }: ScheduleCardProps) {
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: schedule.therapistId });
  const ooos = useQuery(convexApi.queries.ooo.listByTherapist, { therapistId: schedule.therapistId });
  const removeMutation = useMutation(convexApi.mutations.ooo.remove);

  const today = startOfDay(new Date());
  const upcomingOoos = (ooos ?? []).filter((ooo) => !isBefore(parseISO(ooo.endDate), today));

  async function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await removeMutation({ id });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Schedule header — clickable to edit */}
        <div
          className="cursor-pointer space-y-2"
          onClick={() => onEdit(schedule._id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(schedule._id);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">{therapist?.name ?? "Loading..."}</p>
            <Button variant="ghost" size="sm" tabIndex={-1}>
              Edit
            </Button>
          </div>

          {/* Working days */}
          <div className="flex flex-wrap gap-1">
            {schedule.workingDays
              .sort((a, b) => a - b)
              .map((day) => (
                <Badge key={day} variant="secondary" className="text-xs">
                  {DAY_LABELS[day]}
                </Badge>
              ))}
          </div>

          {/* Hours */}
          <div className="text-sm text-muted-foreground">
            <p>
              {schedule.startTime} – {schedule.endTime} · {schedule.availabilityHorizonDays} day horizon
            </p>
          </div>
        </div>

        {/* OoO sub-section */}
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Out of Office</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => onAddOoo?.(schedule.therapistId)}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {upcomingOoos.length > 0 && (
            <div className="space-y-1.5">
              {upcomingOoos.map((ooo) => (
                <div
                  key={ooo._id}
                  className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {formatOooRange(ooo.startDate, ooo.startTime, ooo.endDate, ooo.endTime)}
                    </p>
                    {ooo.reason && (
                      <p className="truncate text-xs text-muted-foreground">{ooo.reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => onEditOoo?.(ooo._id, schedule.therapistId)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive"
                      onClick={(e) => handleRemove(ooo._id, e)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
