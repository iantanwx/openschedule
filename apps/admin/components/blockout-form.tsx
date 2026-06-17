"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openschedule/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface BlockoutFormProps {
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

export function BlockoutForm({ therapistId, editingId, therapists, isOwner, onClose }: BlockoutFormProps) {
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const createMutation = useMutation(convexApi.mutations.blockouts.create);
  const updateMutation = useMutation(convexApi.mutations.blockouts.update);

  // Load existing blockout data when editing
  const existingBlockouts = useQuery(
    convexApi.queries.blockouts.listByTherapist,
    { therapistId: selectedTherapistId },
  );

  useEffect(() => {
    if (editingId && existingBlockouts) {
      const existing = existingBlockouts.find((b) => b._id === editingId);
      if (existing) {
        setDate(existing.date);
        setStartTime(existing.startTime);
        setEndTime(existing.endTime);
        setReason(existing.reason ?? "");
        setSelectedTherapistId(existing.therapistId);
      }
    }
  }, [editingId, existingBlockouts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (editingId) {
        await updateMutation({
          id: editingId,
          date,
          startTime,
          endTime,
          reason: reason || undefined,
        });
      } else {
        await createMutation({
          therapistId: selectedTherapistId,
          date,
          startTime,
          endTime,
          reason: reason || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blockout");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Blockout" : "Add Blockout"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Therapist selector (owner only) */}
          {isOwner && therapists && therapists.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="blockout-therapist">Therapist</Label>
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger id="blockout-therapist">
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

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="blockout-date">Date</Label>
            <Input
              id="blockout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="blockout-start">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="blockout-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="blockout-end">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="blockout-end">
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
            <Label htmlFor="blockout-reason">Reason (optional)</Label>
            <Input
              id="blockout-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Training, Personal"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Add Blockout"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
