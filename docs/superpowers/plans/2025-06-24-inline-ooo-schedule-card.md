# Inline OoO on Schedule Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OoO entries inline into each therapist's schedule card, removing the broken standalone OoO section.

**Architecture:** Expand `ScheduleCard` to query its own OoO entries and render them below schedule details with add/edit/remove actions. Remove the standalone section from `schedule-page.tsx`. Delete `ooo-list.tsx`.

**Tech Stack:** React, Convex (useQuery/useMutation), shadcn UI components

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/admin/components/schedule-card.tsx` | Rewrite | Self-contained card with schedule details + inline OoO entries + Add/Edit/Remove |
| `apps/admin/components/schedule-page.tsx` | Modify | Remove standalone OoO section, manage OooForm dialog state triggered by cards |
| `apps/admin/components/ooo-list.tsx` | Delete | Functionality absorbed into schedule-card |

---

### Task 1: Rewrite ScheduleCard with inline OoO

**Files:**
- Modify: `apps/admin/components/schedule-card.tsx`

- [ ] **Step 1: Replace schedule-card.tsx with new implementation**

The card becomes self-contained: queries its own OoO entries, renders them inline, and exposes callbacks for add/edit/remove actions.

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { Button } from "@openschedule/ui/components/button";
import { Separator } from "@openschedule/ui/components/separator";
import { Plus } from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";

interface ScheduleCardProps {
  schedule: {
    _id: string;
    therapistId: string;
    workingDays: number[];
    startTime: string;
    endTime: string;
    availabilityHorizonDays: number;
  };
  onEdit: (scheduleId: string) => void;
  onAddOoo: (therapistId: string) => void;
  onEditOoo: (oooId: string, therapistId: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatOooRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const formatTime = (time: string): string => {
    const [h, m] = time.split(":");
    const hour = parseInt(h ?? "0", 10);
    const minute = m ?? "00";
    const suffix = hour >= 12 ? "pm" : "am";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === "00" ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
  };

  if (startDate === endDate) {
    return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${formatTime(endTime)}`;
  }

  return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${format(end, "EEE MMM d")}, ${formatTime(endTime)}`;
}

export function ScheduleCard({ schedule, onEdit, onAddOoo, onEditOoo }: ScheduleCardProps) {
  const therapist = useQuery(convexApi.queries.users.getPublic, { id: schedule.therapistId });
  const ooos = useQuery(convexApi.queries.ooo.listByTherapist, { therapistId: schedule.therapistId });
  const removeMutation = useMutation(convexApi.mutations.ooo.remove);

  const today = startOfDay(new Date());
  const upcomingOoos = (ooos ?? []).filter((ooo) => !isBefore(parseISO(ooo.endDate), today));

  async function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await removeMutation({ id });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Schedule header — clickable to edit */}
        <div
          className="cursor-pointer space-y-2"
          onClick={() => onEdit(schedule._id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(schedule._id);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">{therapist?.name ?? "Loading..."}</p>
            <Button variant="ghost" size="sm" tabIndex={-1}>
              Edit
            </Button>
          </div>

          {/* Working days */}
          <div className="flex flex-wrap gap-1">
            {schedule.workingDays
              .sort((a, b) => a - b)
              .map((day) => (
                <Badge key={day} variant="secondary" className="text-xs">
                  {DAY_LABELS[day]}
                </Badge>
              ))}
          </div>

          {/* Hours */}
          <div className="text-sm text-muted-foreground">
            <p>
              {schedule.startTime} – {schedule.endTime} · {schedule.availabilityHorizonDays} day horizon
            </p>
          </div>
        </div>

        {/* OoO sub-section */}
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Out of Office</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => onAddOoo(schedule.therapistId)}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {upcomingOoos.length > 0 && (
            <div className="space-y-1.5">
              {upcomingOoos.map((ooo) => (
                <div
                  key={ooo._id}
                  className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {formatOooRange(ooo.startDate, ooo.startTime, ooo.endDate, ooo.endTime)}
                    </p>
                    {ooo.reason && (
                      <p className="truncate text-xs text-muted-foreground">{ooo.reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => onEditOoo(ooo._id, schedule.therapistId)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive"
                      onClick={(e) => handleRemove(ooo._id, e)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 pre-existing errors (`auth.ts:15`, `triggers.ts:3`). The new `onAddOoo`/`onEditOoo` props will cause errors in `schedule-page.tsx` until Task 2 updates it — that's expected at this step.

Actually, since `schedule-page.tsx` doesn't pass these new props yet, we'll get type errors. That's fine — Task 2 fixes it immediately. But to keep each task independently committable, we need to make the new props optional for now and required in Task 2.

**Correction:** Make `onAddOoo` and `onEditOoo` optional with defaults:

Change the interface to:
```tsx
interface ScheduleCardProps {
  schedule: {
    _id: string;
    therapistId: string;
    workingDays: number[];
    startTime: string;
    endTime: string;
    availabilityHorizonDays: number;
  };
  onEdit: (scheduleId: string) => void;
  onAddOoo?: (therapistId: string) => void;
  onEditOoo?: (oooId: string, therapistId: string) => void;
}
```

And guard the callbacks:
```tsx
onClick={() => onAddOoo?.(schedule.therapistId)}
onClick={() => onEditOoo?.(ooo._id, schedule.therapistId)}
```

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/schedule-card.tsx
git commit -m "feat(admin): inline OoO entries in schedule card"
```

---

### Task 2: Update schedule-page to remove standalone OoO section and wire form

**Files:**
- Modify: `apps/admin/components/schedule-page.tsx`

- [ ] **Step 1: Replace schedule-page.tsx**

Remove: `oooTherapistFilter` state, `oooTherapistId` derived value, the entire OoO section (Separator + heading + filter + OooList), and the old OoO form trigger logic. Keep `showOooForm` and `editingOooId` state but wire them through the card callbacks.

```tsx
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
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/schedule-page.tsx
git commit -m "refactor(admin): remove standalone OoO section, wire form via card callbacks"
```

---

### Task 3: Delete ooo-list.tsx

**Files:**
- Delete: `apps/admin/components/ooo-list.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "ooo-list" apps/admin/`
Expected: No matches (schedule-page.tsx no longer imports it after Task 2).

- [ ] **Step 2: Delete the file**

```bash
rm apps/admin/components/ooo-list.tsx
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/admin/components/ooo-list.tsx
git commit -m "chore(admin): delete ooo-list.tsx (absorbed into schedule-card)"
```

---

### Task 4: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full convex typecheck**

Run: `pnpm --filter @openschedule/convex typecheck`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 2: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: Only the 2 pre-existing errors.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @openschedule/convex test`
Expected: 53/53 tests pass (no backend changes in this feature).

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: Clean working tree (only untracked `qa-bugs.md`).
