"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";
import { BlockoutList } from "./blockout-list";
import { BlockoutForm } from "./blockout-form";
import { Button } from "@openschedule/ui/components/button";
import { Separator } from "@openschedule/ui/components/separator";
import { Spinner } from "@openschedule/ui/components/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

interface SchedulePageProps {
  orgSlug: string;
  venueSlug: string;
}

export function SchedulePage({ orgSlug, venueSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBlockoutForm, setShowBlockoutForm] = useState(false);
  const [editingBlockoutId, setEditingBlockoutId] = useState<string | null>(null);
  const [blockoutTherapistFilter, setBlockoutTherapistFilter] = useState<string | null>(null);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const schedules = useQuery(
    convexApi.queries.schedules.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  // Org-member therapists (NOT schedule-driven) so the create picker and
  // blockout filter work before any schedule exists.
  const therapists = useQuery(
    convexApi.queries.users.listTherapistsByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const isTherapist = currentUser?.roles.includes("therapist") ?? false;

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  // Pure therapists (no owner role) see only their own schedules; owners see all
  const displayedSchedules = !isOwner && isTherapist && currentUser
    ? (schedules ?? []).filter((s) => s.therapistId === currentUser._id)
    : schedules ?? [];

  // Owner can add a schedule once the org has therapists; a therapist can add
  // their own when they don't yet have one at this venue.
  const canAddSchedule =
    !!currentUser &&
    (isOwner ? (therapists?.length ?? 0) > 0 : isTherapist && displayedSchedules.length === 0);

  // Determine which therapist's blockouts to show
  const blockoutTherapistId = isTherapist
    ? currentUser?._id ?? null
    : blockoutTherapistFilter ?? (therapists?.[0]?._id ?? null);

  const editingSchedule = editingScheduleId
    ? schedules?.find((s) => s._id === editingScheduleId) ?? null
    : null;

  const editingTherapistName = editingSchedule
    ? therapists?.find((t) => t._id === editingSchedule.therapistId)?.name ?? "Unknown"
    : "";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Therapist Schedules</h2>
        {canAddSchedule && (
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            Add Schedule
          </Button>
        )}
      </div>

      {displayedSchedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No schedules configured. Add a schedule to start accepting bookings.
        </p>
      ) : (
        <div className="space-y-3">
          {displayedSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule._id}
              schedule={schedule}
              onEdit={setEditingScheduleId}
            />
          ))}
        </div>
      )}

      {editingSchedule && (
        <ScheduleEditForm
          schedule={editingSchedule}
          venue={{ _id: venue._id, dayStart: venue.dayStart, dayEnd: venue.dayEnd }}
          therapists={therapists ?? []}
          currentUserId={currentUser?._id ?? ""}
          isOwner={isOwner}
          therapistName={editingTherapistName}
          onClose={() => setEditingScheduleId(null)}
        />
      )}

      {showCreateForm && currentUser && (
        <ScheduleEditForm
          schedule={null}
          venue={{ _id: venue._id, dayStart: venue.dayStart, dayEnd: venue.dayEnd }}
          therapists={therapists ?? []}
          currentUserId={currentUser._id}
          isOwner={isOwner}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <Separator />

      {/* Blockouts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Blockouts</h2>
          <Button size="sm" onClick={() => setShowBlockoutForm(true)}>
            Add Blockout
          </Button>
        </div>

        {/* Therapist filter (owner only, when multiple therapists) */}
        {isOwner && therapists && therapists.length > 1 && (
          <Select
            value={blockoutTherapistFilter ?? therapists[0]?._id ?? ""}
            onValueChange={setBlockoutTherapistFilter}
          >
            <SelectTrigger className="w-48">
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
        )}

        {blockoutTherapistId && (
          <BlockoutList
            therapistId={blockoutTherapistId}
            onEdit={(id) => {
              setEditingBlockoutId(id);
              setShowBlockoutForm(true);
            }}
          />
        )}
      </div>

      {/* Blockout form dialog */}
      {showBlockoutForm && blockoutTherapistId && (
        <BlockoutForm
          therapistId={blockoutTherapistId}
          editingId={editingBlockoutId}
          therapists={therapists ?? []}
          isOwner={isOwner}
          onClose={() => {
            setShowBlockoutForm(false);
            setEditingBlockoutId(null);
          }}
        />
      )}
    </div>
  );
}
