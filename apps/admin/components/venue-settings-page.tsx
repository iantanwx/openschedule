"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface VenueSettingsPageProps {
  orgSlug: string;
  venueSlug: string;
}

export function VenueSettingsPage({ orgSlug, venueSlug }: VenueSettingsPageProps) {
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const [venueName, setVenueName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateVenue = useMutation(convexApi.mutations.venues.update);
  const archiveVenue = useMutation(convexApi.mutations.venues.archive);

  const isOwner = currentUser?.roles.includes("owner") ?? false;

  // Initialize form values when venue data arrives
  if (venue && !isInitialized) {
    setVenueName(venue.name);
    setTimezone(venue.timezone);
    setCapacity(venue.capacity);
    setDayStart(venue.dayStart);
    setDayEnd(venue.dayEnd);
    setIsInitialized(true);
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Only owners can manage venue settings.</p>
      </div>
    );
  }

  async function handleSave() {
    if (!venue) return;
    setIsSaving(true);
    try {
      await updateVenue({
        id: venue._id,
        name: venueName,
        timezone,
        capacity,
        dayStart,
        dayEnd,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!venue) return;
    if (!confirm("Archive this venue? All future bookings will be cancelled.")) return;
    await archiveVenue({ id: venue._id });
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Venue Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="venue-name">Name</Label>
            <Input
              id="venue-name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Slug</Label>
            <Input value={venue.slug} disabled />
          </div>

          <div className="space-y-1">
            <Label htmlFor="venue-tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="venue-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="venue-capacity">Capacity</Label>
            <Input
              id="venue-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="venue-start">Day Start</Label>
              <Input
                id="venue-start"
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="venue-end">Day End</Label>
              <Input
                id="venue-end"
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="destructive" size="sm" className="ml-auto" onClick={handleArchive}>
              Archive Venue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
