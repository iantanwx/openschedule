"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";
import { OooForm } from "./ooo-form";
import { Button } from "@openschedule/ui/components/button";
import { Spinner } from "@openschedule/ui/components/spinner";

interface SchedulePageProps {
  orgSlug: string;
  venueSlug: string;
}

export function SchedulePage({ orgSlug, venueSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOooForm, setShowOooForm] = useState(false);
  const [editingOooId, setEditingOooId] = useState<string | null>(null);
  const [oooTargetTherapistId, setOooTargetTherapistId] = useState<string | null>(null);

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

  const editingSchedule = editingScheduleId
    ? schedules?.find((s) => s._id === editingScheduleId) ?? null
    : null;

  const editingTherapistName = editingSchedule
    ? therapists?.find((t) => t._id === editingSchedule.therapistId)?.name ?? "Unknown"
    : "";

  function handleAddOoo(therapistId: string) {
    setOooTargetTherapistId(therapistId);
    setEditingOooId(null);
    setShowOooForm(true);
  }

  function handleEditOoo(oooId: string, therapistId: string) {
    setOooTargetTherapistId(therapistId);
    setEditingOooId(oooId);
    setShowOooForm(true);
  }

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
              onAddOoo={handleAddOoo}
              onEditOoo={handleEditOoo}
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

      {/* OoO form dialog — triggered by card callbacks */}
      {showOooForm && oooTargetTherapistId && (
        <OooForm
          therapistId={oooTargetTherapistId}
          editingId={editingOooId}
          therapists={therapists ?? []}
          isOwner={isOwner}
          onClose={() => {
            setShowOooForm(false);
            setEditingOooId(null);
            setOooTargetTherapistId(null);
          }}
        />
      )}
    </div>
  );
}
