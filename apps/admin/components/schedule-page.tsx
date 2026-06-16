"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { ScheduleCard } from "./schedule-card";
import { ScheduleEditForm } from "./schedule-edit-form";

interface SchedulePageProps {
  orgSlug: string;
}

export function SchedulePage({ orgSlug }: SchedulePageProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const venue = venues?.[0] ?? null;

  const schedules = useQuery(
    convexApi.queries.schedules.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  const therapists = useQuery(
    convexApi.queries.users.listByVenue,
    venue ? { venueId: venue._id } : "skip",
  );

  if (!org || !venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const editingSchedule = editingScheduleId
    ? schedules?.find((s) => s._id === editingScheduleId) ?? null
    : null;

  const editingTherapistName = editingSchedule
    ? therapists?.find((t) => t._id === editingSchedule.therapistId)?.name ?? "Unknown"
    : "";

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Therapist Schedules</h2>

      {(!schedules || schedules.length === 0) ? (
        <p className="text-sm text-muted-foreground">
          No schedules configured. Add a schedule to start accepting bookings.
        </p>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
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
          schedule={{ ...editingSchedule, venueId: venue._id }}
          therapistName={editingTherapistName}
          onClose={() => setEditingScheduleId(null)}
          isOwner={true}
        />
      )}
    </div>
  );
}
