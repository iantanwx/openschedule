"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@/lib/convex-api";
import { signOut, useSession } from "@/lib/auth-client";
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
import { Separator } from "@openschedule/ui/components/separator";
import { TeamSection } from "./team-section";
import { OrgSettingsForm } from "./org-settings-form";

interface SettingsPageProps {
  orgSlug: string;
}

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CreateVenueForm({ orgId }: { orgId: string }) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your First Venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-venue-name">Venue Name</Label>
            <Input
              id="new-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Main Location"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-venue-slug">Slug</Label>
            <Input
              id="new-venue-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="main-location"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-venue-tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="new-venue-tz">
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
            <Label htmlFor="new-venue-capacity">Capacity (beds)</Label>
            <Input
              id="new-venue-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-venue-start">Day Start</Label>
              <Input
                id="new-venue-start"
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-venue-end">Day End</Label>
              <Input
                id="new-venue-end"
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Venue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsPage({ orgSlug }: SettingsPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const [venueName, setVenueName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateVenue = useMutation(convexApi.mutations.venues.update);
  const archiveVenue = useMutation(convexApi.mutations.venues.archive);
  const unarchiveVenue = useMutation(convexApi.mutations.venues.unarchive);

  const isOwner = currentUser?.role === "owner";

  // Initialize form values when venue data arrives
  if (venue && !isInitialized) {
    setVenueName(venue.name);
    setTimezone(venue.timezone);
    setCapacity(venue.capacity);
    setDayStart(venue.dayStart);
    setDayEnd(venue.dayEnd);
    setIsInitialized(true);
  }

  if (org === undefined || venues === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  if (!venue && isOwner) {
    return (
      <div className="space-y-6 p-4">
        <CreateVenueForm orgId={org._id} />
        <Separator />
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {session?.user?.name ?? "Unknown"}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                {session?.user?.email ?? "Unknown"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSaveVenue() {
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

  async function handleUnarchive() {
    if (!venue) return;
    await unarchiveVenue({ id: venue._id });
  }

  return (
    <div className="space-y-6 p-4">
      {/* Venue settings — owner only */}
      {isOwner && venue && (
        <>
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
                <Button size="sm" disabled={isSaving} onClick={handleSaveVenue}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>

                {venue.status === "active" ? (
                  <Button variant="destructive" size="sm" className="ml-auto" onClick={handleArchive}>
                    Archive Venue
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="ml-auto" onClick={handleUnarchive}>
                    Unarchive Venue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />
        </>
      )}

      {/* Team section — owner only */}
      {isOwner && (
        <>
          <TeamSection />
          <Separator />
        </>
      )}

      {/* Org Settings — owner only */}
      {isOwner && org && (
        <>
          <OrgSettingsForm orgId={org._id} />
          <Separator />
        </>
      )}

      {/* Account — visible to all roles */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {session?.user?.name ?? "Unknown"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {session?.user?.email ?? "Unknown"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
