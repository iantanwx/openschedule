"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openschedule/ui/components/dialog";

interface ScheduleFormData {
  _id: string;
  therapistId: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDuration: number;
  availabilityHorizonDays: number;
}

interface ScheduleEditFormProps {
  /** Existing schedule (edit mode) or null (create mode). */
  schedule: ScheduleFormData | null;
  venue: { _id: string; dayStart: string; dayEnd: string };
  therapists: { _id: string; name: string }[];
  currentUserId: string;
  isOwner: boolean;
  therapistName?: string;
  onClose: () => void;
}

const DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const SLOT_DURATIONS = [30, 45, 60, 90, 120];

export function ScheduleEditForm({
  schedule,
  venue,
  therapists,
  currentUserId,
  isOwner,
  therapistName,
  onClose,
}: ScheduleEditFormProps) {
  const isCreate = schedule === null;

  const [therapistId, setTherapistId] = useState<string>(
    schedule?.therapistId ?? (isOwner ? "" : currentUserId),
  );
  const [workingDays, setWorkingDays] = useState<number[]>(
    schedule?.workingDays ?? [1, 2, 3, 4, 5],
  );
  const [startTime, setStartTime] = useState(
    schedule?.startTime || venue.dayStart || "09:00",
  );
  const [endTime, setEndTime] = useState(
    schedule?.endTime || venue.dayEnd || "17:00",
  );
  const [slotDuration, setSlotDuration] = useState(schedule?.slotDuration ?? 60);
  const [horizon, setHorizon] = useState(schedule?.availabilityHorizonDays ?? 30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const upsertSchedule = useMutation(convexApi.mutations.schedules.upsert);
  const removeSchedule = useMutation(convexApi.mutations.schedules.remove);

  function toggleDay(day: number) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const therapistSelected = !isCreate || !isOwner || therapistId !== "";

  async function handleSave() {
    if (!therapistSelected) return;
    setIsSubmitting(true);
    try {
      await upsertSchedule({
        therapistId,
        venueId: venue._id,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        availabilityHorizonDays: horizon,
      });
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isCreate || !schedule) return;
    setIsSubmitting(true);
    try {
      await removeSchedule({ id: schedule._id });
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  }

  const title = isCreate
    ? "Add schedule"
    : `Edit schedule — ${therapistName ?? "Unknown"}`;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Therapist picker (owner, create mode only) */}
          {isCreate && isOwner && (
            <div className="space-y-1">
              <Label>Therapist</Label>
              <Select value={therapistId} onValueChange={setTherapistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select therapist" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Working days */}
          <div className="space-y-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <Button
                  key={day.value}
                  variant={workingDays.includes(day.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                  type="button"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sched-start">Start time</Label>
              <Input
                id="sched-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-end">End time</Label>
              <Input
                id="sched-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Slot duration */}
          <div className="space-y-1">
            <Label>Slot Duration</Label>
            <Select
              value={String(slotDuration)}
              onValueChange={(val) => setSlotDuration(Number(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOT_DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Availability horizon */}
          <div className="space-y-1">
            <Label htmlFor="sched-horizon">Availability Horizon (days)</Label>
            <Input
              id="sched-horizon"
              type="number"
              min={1}
              max={90}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              disabled={isSubmitting || workingDays.length === 0 || !therapistSelected}
              onClick={handleSave}
            >
              {isSubmitting ? "Saving..." : isCreate ? "Create" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {!isCreate && isOwner && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                disabled={isSubmitting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
