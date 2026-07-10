"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@opencal/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";

interface OooFormProps {
  therapistId: string;
  editingId?: string | null;
  therapists?: Array<{ _id: string; name: string }>;
  isOwner: boolean;
  onClose: () => void;
}

const TIME_OPTIONS = generateTimeOptions();

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

export function OooForm({ therapistId, editingId, therapists, isOwner, onClose }: OooFormProps) {
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bookingWarning, setBookingWarning] = useState<string | null>(null);

  const createMutation = useMutation(convexApi.mutations.ooo.create);
  const updateMutation = useMutation(convexApi.mutations.ooo.update);

  // Load existing OoO data when editing
  const existingOoos = useQuery(
    convexApi.queries.ooo.listByTherapist,
    { therapistId: selectedTherapistId },
  );

  // Check for overlapping bookings when dates are set
  const bookingsInRange = useQuery(
    convexApi.queries.bookings.listByTherapistAndDateRange,
    startDate && endDate
      ? { therapistId: selectedTherapistId, startDate, endDate }
      : "skip",
  );

  useEffect(() => {
    if (editingId && existingOoos) {
      const existing = existingOoos.find((o) => o._id === editingId);
      if (existing) {
        setStartDate(existing.startDate);
        setStartTime(existing.startTime);
        setEndDate(existing.endDate);
        setEndTime(existing.endTime);
        setReason(existing.reason ?? "");
        setSelectedTherapistId(existing.therapistId);
      }
    }
  }, [editingId, existingOoos]);

  // Update booking warning when bookings data changes
  useEffect(() => {
    if (bookingsInRange && bookingsInRange.length > 0) {
      const activeBookings = bookingsInRange.filter((b) => b.status !== "cancelled");
      if (activeBookings.length > 0) {
        setBookingWarning(
          `You have ${activeBookings.length} booking${activeBookings.length > 1 ? "s" : ""} during this period that may need rescheduling.`,
        );
      } else {
        setBookingWarning(null);
      }
    } else {
      setBookingWarning(null);
    }
  }, [bookingsInRange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (editingId) {
        await updateMutation({
          id: editingId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason: reason || undefined,
        });
      } else {
        await createMutation({
          therapistId: selectedTherapistId,
          startDate,
          startTime,
          endDate,
          endTime,
          reason: reason || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save out-of-office");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Out of Office" : "Add Out of Office"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Therapist selector (owner only) */}
          {isOwner && therapists && therapists.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="ooo-therapist">Therapist</Label>
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger id="ooo-therapist">
                  <SelectValue />
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

          {/* Start date + time */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ooo-start-date">Start Date</Label>
              <Input
                id="ooo-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Auto-set end date if empty or before start
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ooo-start-time">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="ooo-start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End date + time */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ooo-end-date">End Date</Label>
              <Input
                id="ooo-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ooo-end-time">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="ooo-end-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <Label htmlFor="ooo-reason">Reason (optional)</Label>
            <Input
              id="ooo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vacation, Training, Personal"
            />
          </div>

          {/* Booking overlap warning */}
          {bookingWarning && (
            <p className="text-sm text-amber-600">{bookingWarning}</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Add Out of Office"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
