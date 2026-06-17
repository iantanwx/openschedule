# Admin Phase 2 — Invitations, Blockouts, Org Settings, Email

## Overview

Phase 2 adds therapist team management, blockout CRUD, org-level settings, and transactional email delivery to the admin app. These features are interdependent: invitations require email, the notification toggle requires email, and blockouts complete the availability story for therapists.

## Scope

1. Therapist invitations (invite by email, accept flow, member list, remove)
2. Blockout management (CRUD UI on Schedule tab)
3. Org settings (business info + notification toggle)
4. Email delivery via Resend (invitation emails + booking notification emails)

**Out of scope:** Google Calendar integration (separate spec), recurring blockouts, drag-and-drop, push notifications.

---

## 1. Therapist Invitations

### Location

Settings tab > "Team" section (owner only).

### Flow

1. Owner enters email → clicks "Invite as Therapist"
2. better-auth org plugin creates invitation record (email, orgId, role: "member", status: "pending"). Note: better-auth uses "member" as the role internally; the `member.onCreate` trigger maps this to "therapist" in the app users table.
3. `sendInvitationEmail` callback fires → schedules a Convex action that sends email via Resend with invite link
4. Therapist clicks link → lands on signup page (email pre-filled) → creates account
5. `member.onCreate` trigger fires → patches app user with `orgId` + `role: "therapist"`
6. Therapist lands on their scoped dashboard (empty state, no forced onboarding)

If the therapist already has an account: they log in, invitation auto-accepted.

### UI Components

**Team section (owner only, inside Settings tab):**
- Active members list: name, email, role badge, "Remove" button (with confirm dialog)
- Pending invitations: email, sent date, "Resend" and "Cancel" buttons
- Invite form: email input + "Invite as Therapist" button

### Backend

No new Convex mutations needed — better-auth org plugin provides:
- `authClient.organization.inviteMember({ email, role: "member" })`
- `authClient.organization.removeMember({ memberId })`
- `authClient.organization.listMembers()`
- `authClient.organization.getInvitation()` / `cancelInvitation()`

The `sendInvitationEmail` callback in `betterAuth/auth.ts` must be implemented to schedule the email action.

### Invariants

- Only owners can invite/remove members
- Cannot invite an email that's already a member
- Cannot invite an email that already has a pending invitation
- Owner cannot remove themselves
- `member.onDelete` trigger must: clear user's orgId/role, set their schedules to inactive, set their blockouts to inactive, cancel their future bookings
- Therapist is the only invitable role
- Invitation links are org-scoped

---

## 2. Blockout Management

### Location

Schedule tab, below schedule cards.

### UI Components

- **Header:** "Blockouts" + "Add Blockout" button
- **Filter:** Therapist dropdown (owner sees all therapists, therapist sees only themselves — dropdown hidden for therapists)
- **List:** Cards showing date, time range, reason. Edit/remove actions. Past blockouts visually dimmed.
- **Add/Edit dialog:** Date picker (single date), start time / end time (select, 30-min increments), reason (optional text), therapist selector (owner only)

### Backend Changes

- `blockouts.remove` → change from hard delete to soft-delete (`status: "inactive"`)
- Add `blockouts.activate` mutation (restore to active)
- Update `blockouts.listByTherapist` to filter `status === "active"`
- Update `blockouts.listByTherapistAndDateRange` to filter `status === "active"`
- Availability queries already filter active blockouts (done in auth system implementation)

### Invariants

- Blockouts are therapist-global (not venue-scoped)
- A therapist can only manage their own blockouts; owner can manage any
- Soft-delete only — `remove` sets status: "inactive", never hard deletes
- Active blockouts must affect slot computation
- Cannot create a blockout in the past
- Start time must be before end time
- No recurring blockouts (each is a single date/time window)

---

## 3. Org Settings

### Location

Settings tab, new section between Venue and Account (owner only).

### UI — Two Sub-sections

**Business Info:**
- Org name (editable)
- Contact email
- Contact phone
- Logo (file upload → Convex file storage, preview thumbnail, "Remove" link)

**Notifications:**
- Single toggle: "Email notifications" (on/off)
- Helper text: "When enabled, booking confirmations, cancellations, and reschedules are emailed to the therapist and customer."

### Backend

- New `settings.getByOrg` query — fetches org-scoped settings doc
- New `settings.upsert` mutation — creates or patches org settings (scope: "org", scopeId: orgId)
- New `storage.generateUploadUrl` action for logo upload
- Settings data shape (version 1):

```typescript
{
  businessName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoStorageId: string | null;
  emailNotificationsEnabled: boolean;
}
```

### Invariants

- Only owners can view/edit org settings
- Logo uses Convex file storage (not external URLs)
- Settings doc created lazily (on first save, not on org creation)
- When logo is replaced, old storage file must be deleted
- Default: emailNotificationsEnabled = false, all other fields null/empty

---

## 4. Email Delivery via Resend

### Architecture

- **Provider:** Resend (HTTP API, no SDK needed)
- **Implementation:** Convex actions that call Resend API via fetch
- **Trigger mechanism:** Mutations schedule actions via `ctx.scheduler.runAfter(0, ...)` — fire-and-forget, never blocks the mutation
- **Dev mode:** If `RESEND_API_KEY` is not set, log email content to console (local dev works without credentials)

### Emails Sent

| Event | Recipients | Subject |
|-------|-----------|---------|
| Invitation created | Invited email | "You've been invited to join {orgName}" |
| Booking confirmed | Customer + therapist | "Booking confirmed — {date} at {time}" |
| Booking cancelled | Customer + therapist | "Booking cancelled — {date} at {time}" |
| Booking rescheduled | Customer + therapist | "Booking rescheduled — new time: {date} at {time}" |

Owner is notified on new bookings only if `emailNotificationsEnabled` is true in org settings.

### Backend

- New `src/actions/email.ts` — Resend HTTP call wrapper
- New `src/actions/sendBookingNotification.ts` — resolves booking/customer/therapist data, formats email, calls send
- New `src/actions/sendInvitationEmail.ts` — formats invitation email with link, calls send
- Update `bookings.confirm`, `bookings.cancel`, `bookings.reschedule` — schedule email action after successful mutation
- Update `betterAuth/auth.ts` `sendInvitationEmail` callback — schedule invitation email action

### Env Vars

- `RESEND_API_KEY` — set on Convex deployment (required for prod, optional for dev)
- `FROM_EMAIL` — sender address (e.g., "notifications@openschedule.com")
- `APP_URL` — base URL for invitation links (e.g., "https://admin.openschedule.com")

### Email Templates

Plain-text for MVP (no HTML templates). Each email has:
- Subject line
- Body with booking/invitation details
- Link (for invitations: accept URL; for bookings: booking detail page URL)

### Invariants

- Email sending must never block the mutation (fire-and-forget via scheduler)
- Failed email sends log the error but don't throw (booking/invite still succeeds)
- No email sent for already-cancelled bookings (idempotency)
- Booking notifications only sent if `emailNotificationsEnabled` is true in org settings
- Invitation emails always sent regardless of notification toggle (they're operational, not optional)

---

## 5. Role Scoping (Therapist View)

### Changes to Existing Tabs

**Today tab:**
- Therapist sees "My Bookings" by default (only their assigned bookings on time grid)
- Toggle to "All Bookings" — read-only view of all venue bookings (no action buttons)
- Owner always sees all bookings (no toggle needed)

**Bookings tab:**
- Same "My / All" toggle for therapists
- In "All" view: no confirm/cancel/reschedule actions visible

**Schedule tab:**
- Therapist sees only their own schedule card
- Therapist sees only their own blockouts (no therapist filter dropdown)

**Settings tab:**
- Therapist sees only: Account section
- Hidden for therapist: Venue, Team, Org Settings

### Backend

The existing auth guard (`getAuthenticatedUser` + `assertRole`) already handles mutation protection. The scoping is purely a UI concern — queries already accept therapistId as a filter parameter.

New query needed: `users.getSelf` — returns the current authenticated user's doc (so the UI knows the role and can scope accordingly).

---

## 6. Invariants Summary

### Authorization
- Only owners can: invite/remove members, edit org settings, edit venue settings, archive venues, override capacity
- Therapists can: manage own schedule, manage own blockouts, view own + all bookings, confirm/cancel own bookings
- Owner cannot remove themselves from org

### Data Integrity
- Soft-delete convention: blockouts use status (active/inactive), never hard delete
- `member.onDelete` cascade: clear orgId/role, inactivate schedules/blockouts, cancel future bookings
- Settings created lazily, not eagerly
- Logo replacement deletes old file from storage

### Email
- Never blocks mutations
- Fails silently (logs error)
- Respects notification toggle (except invitations, which always send)
- Idempotent (no duplicate sends)

### Temporal
- Cannot create blockouts in the past
- Blockout start time < end time
- Member removal cancels only future bookings (past bookings preserved for records)

---

## 7. Testing Plan

### Unit Tests (convex-test, run locally)

1. `blockouts.remove` sets status to "inactive" (not hard delete)
2. `blockouts.activate` restores status to "active"
3. `blockouts.listByTherapist` returns only active blockouts
4. `blockouts.listByTherapistAndDateRange` returns only active blockouts
5. `settings.getByOrg` returns null when no settings exist
6. `settings.upsert` creates doc on first call, patches on subsequent
7. `settings.upsert` rejects non-owner
8. Cannot create blockout with startTime >= endTime
9. Cannot create blockout with date in the past
10. Email action skips sending when RESEND_API_KEY is missing (logs instead)
11. Booking mutations schedule email action after success
12. Email action respects notification toggle (no send when disabled)

### E2E Tests (agent-browser against running app)

Executed by the agent using `agent-browser` against `localhost:3001` (admin) and `localhost:3000` (web) with `convex dev` running.

**Test 1: Invitation flow**
- Owner signs up → creates org → creates venue → navigates to Settings > Team
- Invites therapist email → verify pending invitation appears
- Read invite URL from Convex function logs (console.log fallback)
- Open invite URL in new session → therapist signs up
- Verify therapist appears in member list
- Verify therapist can log in and sees scoped view (only own schedule, only account in settings)

**Test 2: Remove member**
- Owner removes therapist from Team section
- Verify member disappears from list
- Verify therapist's schedules set to inactive (check Schedule tab)
- Verify therapist can no longer access org dashboard (redirect to onboarding or error)

**Test 3: Blockout CRUD**
- Owner creates schedule for therapist → navigates to Schedule tab
- Adds blockout (future date, 10:00-12:00, reason: "Training")
- Verifies blockout appears in list
- Edits blockout (change time to 10:00-11:00)
- Verifies change reflected
- Removes blockout → verifies it disappears from active list

**Test 4: Blockout affects availability**
- Create blockout for a therapist on a specific date/time
- Open customer booking page (`localhost:3000`) for that therapist
- Verify the blocked time slot is no longer available
- Remove the blockout
- Verify the slot reappears

**Test 5: Org settings CRUD**
- Owner navigates to Settings → Org Settings section
- Fills business info (name, email, phone)
- Saves → reloads → verify data persists
- Toggles "Email notifications" on → saves → verify toggle persists after reload

**Test 6: Logo upload**
- Upload a logo file in Org Settings
- Verify preview thumbnail appears
- Replace with new logo → verify preview updates
- Remove logo → verify preview gone

**Test 7: Therapist scoped view**
- Log in as therapist
- Verify Today shows "My Bookings" by default
- Toggle to "All Bookings" → see all venue bookings (no action buttons)
- Go to Schedule → see only own schedule card + own blockouts
- Go to Settings → see only Account (no Venue, Team, Org sections)

**Test 8: Email delivery (dev mode)**
- Ensure RESEND_API_KEY is not set
- Create a booking and confirm it
- Check Convex function logs → verify email content logged to console
- Verify no error thrown, booking still confirmed

### Test Data Setup

For E2E tests, seed data via Convex dashboard or mutations:
- Organization with venue (capacity 3, timezone Asia/Singapore)
- Owner user (created via signup)
- At least one therapist (created via invitation flow in Test 1)
- Schedule for therapist (Mon-Fri, 09:00-17:00, 60min slots)

---

## 8. File Structure (New/Modified)

### New Files
- `packages/convex/src/mutations/settings.ts` — settings CRUD
- `packages/convex/src/queries/settings.ts` — settings read
- `packages/convex/src/actions/email.ts` — Resend HTTP wrapper
- `packages/convex/src/actions/sendBookingNotification.ts` — booking email logic
- `packages/convex/src/actions/sendInvitationEmail.ts` — invitation email logic
- `packages/convex/src/queries/users.ts` (modify) — add `getSelf` query
- `apps/admin/components/team-section.tsx` — member list + invite form
- `apps/admin/components/blockout-list.tsx` — blockout cards
- `apps/admin/components/blockout-form.tsx` — add/edit dialog
- `apps/admin/components/org-settings-form.tsx` — business info + notification toggle
- `apps/admin/components/view-toggle.tsx` — "My / All" toggle component

### Modified Files
- `packages/convex/src/mutations/blockouts.ts` — soft-delete, add activate
- `packages/convex/src/queries/blockouts.ts` — filter by active status
- `packages/convex/src/mutations/bookings.ts` — schedule email after confirm/cancel/reschedule
- `packages/convex/src/betterAuth/auth.ts` — implement sendInvitationEmail callback
- `apps/admin/components/settings-page.tsx` — add Team + Org Settings sections, hide for therapists
- `apps/admin/components/schedule-page.tsx` — add Blockouts section below cards
- `apps/admin/components/today-page.tsx` — add view toggle, scope bookings by role
- `apps/admin/components/bookings-page.tsx` — add view toggle, scope by role
- `apps/admin/components/booking-detail-modal.tsx` — hide actions in read-only mode
