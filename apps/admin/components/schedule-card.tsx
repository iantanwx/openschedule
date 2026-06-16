"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";

interface ScheduleCardProps {
  schedule: {
    _id: string;
    therapistId: string;
    workingDays: number[];
    startTime: string;
    endTime: string;
    slotDuration: number;
    availabilityHorizonDays: number;
  };
  onEdit: (scheduleId: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleCard({ schedule, onEdit }: ScheduleCardProps) {
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: schedule.therapistId });

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
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
      <CardContent className="space-y-2 p-4">
        <p className="font-medium">{therapist?.name ?? "Loading..."}</p>

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

        {/* Hours and slot info */}
        <div className="text-sm text-muted-foreground">
          <p>
            {schedule.startTime} – {schedule.endTime}
          </p>
          <p>{schedule.slotDuration} min slots · {schedule.availabilityHorizonDays} day horizon</p>
        </div>
      </CardContent>
    </Card>
  );
}
