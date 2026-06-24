"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Plus } from "lucide-react";
import { TimezoneCombobox } from "./timezone-combobox";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CreateVenueCardProps {
  orgId: string;
}

export function CreateVenueCard({ orgId }: CreateVenueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      setIsExpanded(false);
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setIsCreating(false);
    }
  }

  if (!isExpanded) {
    return (
      <Card
        className="flex cursor-pointer items-center justify-center border-dashed transition-colors hover:bg-muted/50"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <Plus className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Add Venue</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="create-venue-name">Name</Label>
            <Input
              id="create-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Location name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-slug">Slug</Label>
            <Input
              id="create-venue-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="location-name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-tz">Timezone</Label>
            <TimezoneCombobox
              id="create-venue-tz"
              value={timezone}
              onValueChange={setTimezone}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-venue-cap">Capacity</Label>
            <Input
              id="create-venue-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="create-venue-start">Day Start</Label>
              <Input id="create-venue-start" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-venue-end">Day End</Label>
              <Input id="create-venue-end" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
