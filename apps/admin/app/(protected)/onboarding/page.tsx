"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { Spinner } from "@opencal/ui/components/spinner";
import { ArrowLeft } from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const createVenue = useMutation(convexApi.mutations.venues.create);
  const upsertSettings = useMutation(convexApi.mutations.settings.upsert);

  // Check if user already has an active org (e.g. refreshed mid-onboarding)
  const { data: activeOrg, isPending: orgPending } = authClient.useActiveOrganization();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Org fields
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Step 2: Venue fields
  const [venueName, setVenueName] = useState("");
  const [venueSlug, setVenueSlug] = useState("");
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [capacity, setCapacity] = useState(1);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("17:00");
  const [address, setAddress] = useState("");
  const [venueCoordinates, setVenueCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [venuePlaceId, setVenuePlaceId] = useState<string | null>(null);

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);

  // Resolve the real Convex org _id — either from freshly created slug or existing active org
  const resolveSlug = orgCreated ? orgSlug : (activeOrg?.slug ?? null);
  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    resolveSlug ? { slug: resolveSlug } : "skip",
  );

  // Check if org already has venues (to decide if onboarding is complete)
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  // If user already has an org with venues, redirect to dashboard
  useEffect(() => {
    if (org && venues && venues.length > 0) {
      router.replace(`/${org.slug ?? resolveSlug}`);
    }
  }, [org, venues, router, resolveSlug]);

  // If user has an active org but no venues, skip to step 2
  useEffect(() => {
    if (!orgPending && activeOrg && !orgCreated) {
      setOrgName(activeOrg.name ?? "");
      setOrgSlug(activeOrg.slug ?? "");
      setStep(2);
    }
  }, [orgPending, activeOrg, orgCreated]);

  // Don't render until we know whether the user has an existing org
  if (orgPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    setOrgSlug(slugify(value));
  }

  function handleVenueNameChange(value: string) {
    setVenueName(value);
    setVenueSlug(slugify(value));
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.organization.create({
      name: orgName,
      slug: orgSlug,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Failed to create organization");
    } else {
      // Set as active organization
      await authClient.organization.setActive({
        organizationId: result.data.id,
      });
      setOrgCreated(true);
      setStep(2);
    }
  }

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setError(null);
    setLoading(true);

    try {
      await createVenue({
        orgId: org._id as any,
        name: venueName,
        slug: venueSlug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
        address: address || undefined,
        coordinates: venueCoordinates || undefined,
        placeId: venuePlaceId || undefined,
      });
      // Seed org settings with the business name from onboarding
      await upsertSettings({
        orgId: org._id as any,
        data: {
          businessName: orgName,
          contactEmail: null,
          contactPhone: null,
          logoStorageId: null,
          emailNotificationsEnabled: true,
        },
      });
      router.push(`/${orgSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div
            className={`h-2 w-8 rounded-full ${
              step === 1 ? "bg-foreground" : "bg-muted"
            }`}
          />
          <div
            className={`h-2 w-8 rounded-full ${
              step === 2 ? "bg-foreground" : "bg-muted"
            }`}
          />
        </div>

        {step === 1 && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Create your organization</h1>
              <p className="text-muted-foreground text-sm">
                Step 1 of 2 — Set up your scheduling workspace
              </p>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  type="text"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  required
                  placeholder="My Clinic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">URL slug</Label>
                <Input
                  id="org-slug"
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  placeholder="my-clinic"
                />
                <p className="text-xs text-muted-foreground">
                  admin.opencal.xyz/{orgSlug || "your-org"}
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Continue"}
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Create your first venue</h1>
              <p className="text-muted-foreground text-sm">
                Step 2 of 2 — Where do your sessions happen?
              </p>
            </div>

            <form onSubmit={handleCreateVenue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="venue-name">Venue name</Label>
                <Input
                  id="venue-name"
                  type="text"
                  value={venueName}
                  onChange={(e) => handleVenueNameChange(e.target.value)}
                  required
                  placeholder="Main Studio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-slug">URL slug</Label>
                <Input
                  id="venue-slug"
                  type="text"
                  value={venueSlug}
                  onChange={(e) => setVenueSlug(e.target.value)}
                  required
                  placeholder="main-studio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-tz">Timezone</Label>
                <TimezoneCombobox
                  id="venue-tz"
                  value={timezone}
                  onValueChange={setTimezone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-address">Address</Label>
                <AddressAutocomplete
                  id="venue-address"
                  value={address}
                  onChange={(addr, coords, pId) => {
                    setAddress(addr);
                    if (coords) setVenueCoordinates(coords);
                    if (pId) setVenuePlaceId(pId);
                  }}
                  placeholder="Start typing an address..."
                />
              </div>
              <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="venue-day-start">Day start</Label>
                  <Input
                    id="venue-day-start"
                    type="time"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-day-end">Day end</Label>
                  <Input
                    id="venue-day-end"
                    type="time"
                    value={dayEnd}
                    onChange={(e) => setDayEnd(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  aria-label="Back to step 1"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || !org}>
                  {loading ? "Creating..." : "Create venue"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
