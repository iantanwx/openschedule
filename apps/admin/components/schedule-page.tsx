"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";
import { OooList } from "./ooo-list";
import { OooForm } from "./ooo-form";
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
  const [showOooForm, setShowOooForm] = useState(false);
  const [editingOooId, setEditingOooId] = useState<string | null>(null);
  const [oooTherapistFilter, setOooTherapistFilter] = useState<string | null>(null);

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

  const displayedSchedules = !isOwner && isTherapist && currentUser
    ? (schedules ?? []).filter((s) => s.therapistId === currentUser._id)
    : schedules ?? [];

  const canAddSchedule =
    !!currentUser &&
    (isOwner ? (therapists?.length ?? 0) > 0 : isTherapist && displayedSchedules.length === 0);

  // Determine which therapist's OoOs to show
  const oooTherapistId = isTherapist
    ? currentUser?._id ?? null
    : oooTherapistFilter ?? (therapists?.[0]?._id ?? null);

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

      {/* Out of Office section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Out of Office</h2>
          <Button size="sm" onClick={() => setShowOooForm(true)}>
            Add Out of Office
          </Button>
        </div>

        {/* Therapist filter (owner only, when multiple therapists) */}
        {isOwner && therapists && therapists.length > 1 && (
          <Select
            value={oooTherapistFilter ?? therapists[0]?._id ?? ""}
            onValueChange={setOooTherapistFilter}
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

        {oooTherapistId && (
          <OooList
            therapistId={oooTherapistId}
            onEdit={(id) => {
              setEditingOooId(id);
              setShowOooForm(true);
            }}
          />
        )}
      </div>

      {/* OoO form dialog */}
      {showOooForm && oooTherapistId && (
        <OooForm
          therapistId={oooTherapistId}
          editingId={editingOooId}
          therapists={therapists ?? []}
          isOwner={isOwner}
          onClose={() => {
            setShowOooForm(false);
            setEditingOooId(null);
          }}
        />
      )}
    </div>
  );
}
