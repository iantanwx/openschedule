# Multi-Venue Admin Design

## Goal

Replace the single-venue assumption (`venues?.[0]`) in the admin app with a hybrid route structure: an org-level dashboard showing all venues and aggregated bookings, plus venue-scoped routes for managing each venue independently. Venue context is preserved in the URL.

## Route Structure

```
/:orgSlug                              → Org dashboard (venue cards + aggregated today)
/:orgSlug/team                         → Team management (owner only)
/:orgSlug/settings                     → Org settings (name, logo, email notifications)
/:orgSlug/venues/:venueSlug            → Venue today view (default tab)
/:orgSlug/venues/:venueSlug/bookings   → Venue bookings
/:orgSlug/venues/:venueSlug/schedule   → Venue schedules + blockouts
/:orgSlug/venues/:venueSlug/settings   → Venue settings (name, slug, timezone, capacity, hours)
```

The current flat tab structure (`/:orgSlug` with Today/Bookings/Schedule/Settings bottom tabs) is replaced.

## Navigation

### Top Bar

**Inside a venue (`/:orgSlug/venues/:venueSlug/...`):**
- Breadcrumb: `Org Name > Venue Name`
- "Org Name" links to `/:orgSlug` (org dashboard).
- "Venue Name" is a dropdown — lists all org venues. Clicking another venue navigates to the same tab at that venue (e.g., if on `/:orgSlug/venues/downtown/schedule` and you pick "Uptown", go to `/:orgSlug/venues/uptown/schedule`).
- User avatar on the right (unchanged).

**On org-level pages (`/:orgSlug`, `/:orgSlug/team`, `/:orgSlug/settings`):**
- Just "Org Name" (no breadcrumb depth). User avatar on right.

### Bottom Tab Bar

**Inside a venue:** Shows 4 tabs — Today, Bookings, Schedule, Settings. Links point to venue-scoped routes.

**On org dashboard / Team / Settings:** No bottom TabBar. Navigation is via the top bar or inline links.

## Pages

### Org Dashboard (`/:orgSlug`)

**Top section — Venue cards grid:**
- One card per venue: venue name, today's booking count (pending + confirmed), timezone.
- Click a card → `/:orgSlug/venues/:venueSlug`.
- Last card = "+ Add Venue" button (owner only).
- If org has 0 venues, show the "Create Your First Venue" onboarding card (moved from settings).

**Bottom section — Aggregated today's bookings:**
- The time-grid showing today's bookings from ALL venues.
- Each booking shows a venue badge/label.
- Optional venue filter (dropdown above the grid to scope to a single venue).

### Venue Today (`/:orgSlug/venues/:venueSlug`)

Same as the current Today page, but scoped to the resolved venue (no more `venues?.[0]`). The venue is resolved via `venues.getBySlug` using the route param.

### Venue Bookings (`/:orgSlug/venues/:venueSlug/bookings`)

Same as current Bookings page, scoped to the resolved venue.

### Venue Schedule (`/:orgSlug/venues/:venueSlug/schedule`)

Same as current Schedule page (schedules + blockouts combined), scoped to the resolved venue.

### Venue Settings (`/:orgSlug/venues/:venueSlug/settings`)

Venue-specific settings: name, slug, timezone, capacity, day start/end. Extracted from the current settings page's venue section.

### Org Settings (`/:orgSlug/settings`)

Org-level settings only: org name, logo upload, email notifications toggle. The venue-specific fields move to the venue settings page.

### Team (`/:orgSlug/team`)

Moved from being a section in a tab to its own org-level route. Same functionality: invite therapists, list members, manage roles. Owner only.

## Role Scoping

- **Owner:** Sees all venues on the dashboard. Can navigate to any venue. Sees Team and org Settings links.
- **Therapist:** Sees only venues where they have an active schedule (filter `listByOrg` results client-side against their schedules, or add a `listVenuesForTherapist` query). No Team link. No org Settings link. If therapist has exactly one venue, the dashboard could auto-redirect to that venue (optional enhancement — defer for MVP).

## Component Refactoring

### Pages that change

| Current component | Change |
|---|---|
| `today-page.tsx` | Remove `venues?.[0]`, accept venue from route context. Reuse for the venue today view. |
| `bookings-page.tsx` | Same — accept venue from route context. |
| `schedule-page.tsx` | Same — accept venue from route context. Already got `listTherapistsByOrg` fix. |
| `settings-page.tsx` | Split into two: `org-settings-page.tsx` (org fields + email toggle) and `venue-settings-page.tsx` (venue fields). |
| `team-section.tsx` | Move to its own page component at the `/team` route. |
| `top-bar.tsx` | Add breadcrumb + venue switcher dropdown. |
| `tab-bar.tsx` | Make venue-aware (links include `/:orgSlug/venues/:venueSlug/...`). Hide on org-level pages. |

### New components

| Component | Purpose |
|---|---|
| `org-dashboard-page.tsx` | Venue cards + aggregated today grid |
| `venue-card.tsx` | Card showing venue name + today stats |
| `venue-switcher.tsx` | Dropdown in top bar listing org venues |
| `venue-settings-page.tsx` | Venue-specific settings form |
| `org-settings-page.tsx` | Org-level settings (extracted from current settings) |

### Venue context pattern

Instead of each page calling `listByOrg` + `venues?.[0]`, venue-scoped pages resolve the venue once via the route param:

```tsx
// In a venue-scoped page component
const { venueSlug } = useParams<{ orgSlug: string; venueSlug: string }>();
const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
const venue = useQuery(
  convexApi.queries.venues.getBySlug,
  org ? { orgId: org._id, slug: venueSlug } : "skip",
);
```

This replaces the current `listByOrg` + `[0]` pattern with a direct slug-based lookup. The new `venues.getBySlugFull` query (see Backend Changes) returns the full `Venue` doc needed by admin pages.

## Backend Changes

Minimal:
- `queries/venues.ts` — add `getBySlugFull({ orgId, slug })` returning the full `Venue` doc (including `dayStart`, `dayEnd`, `capacity` needed by admin pages). Current `getBySlug` returns `VenuePublic` (id, name, slug, timezone only) — insufficient for venue settings/schedule pages.
- Therapist venue scoping (MVP): filter `listByOrg` results client-side against the therapist's schedules (already loaded). No new query needed. Defer a dedicated `listForTherapist` query unless performance becomes a concern.
- No schema changes.

## What's NOT Changing

- Customer app — no changes.
- Backend schema — no changes.
- Existing mutations (bookings, schedules, venues, settings) — no changes.
- Booking creation, cancel flow, email actions — no changes.
- The onboarding route (`/onboarding`) — still creates the first venue during signup.

## File Structure (Next.js routes)

```
apps/admin/app/(protected)/[orgSlug]/
├── (dashboard)/
│   └── page.tsx                    → Org dashboard
├── team/
│   └── page.tsx                    → Team management
├── settings/
│   └── page.tsx                    → Org settings
└── venues/
    └── [venueSlug]/
        ├── (tabs)/
        │   ├── layout.tsx          → Venue shell (TopBar + TabBar)
        │   ├── page.tsx            → Venue Today
        │   ├── bookings/
        │   │   └── page.tsx        → Venue Bookings
        │   └── schedule/
        │       └── page.tsx        → Venue Schedule
        └── settings/
            └── page.tsx            → Venue Settings
```

The current `(tabs)/` layout group moves under `venues/[venueSlug]/`. The org-level pages (`dashboard`, `team`, `settings`) sit directly under `[orgSlug]` with their own layout (TopBar only, no TabBar).

## Testing

- No backend test changes expected (no schema/mutation changes).
- Admin typecheck must pass after routing refactor.
- E2E verification: create a second venue, switch between them, verify bookings/schedules are scoped correctly.
