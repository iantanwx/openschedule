"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { TimezoneCombobox } from "./timezone-combobox";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CreateVenueDialogProps {
  orgId: string;
  onClose: () => void;
}

export function CreateVenueDialog({ orgId, onClose }: CreateVenueDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("17:00");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVenue = useMutation(convexApi.mutations.venues.create);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      await createVenue({
        orgId: orgId as any,
        name,
        slug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Add Venue</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dlg-venue-name">Name</Label>
            <Input
              id="dlg-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Location name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlg-venue-slug">Slug</Label>
            <Input
              id="dlg-venue-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="location-name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlg-venue-tz">Timezone</Label>
            <TimezoneCombobox
              id="dlg-venue-tz"
              value={timezone}
              onValueChange={setTimezone}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlg-venue-cap">Capacity</Label>
            <Input
              id="dlg-venue-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dlg-venue-start">Day Start</Label>
              <Input id="dlg-venue-start" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dlg-venue-end">Day End</Label>
              <Input id="dlg-venue-end" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Venue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
