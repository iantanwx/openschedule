# Admin Navigation Overhaul — Design Spec

## Summary

Restructure the admin app navigation from the current flat TopBar + OrgNav + bottom TabBar to a responsive Vercel-style layout: persistent sidebar on desktop, horizontal link-tabs on mobile. Venue selection transitions from sidebar/list view to a focused venue detail with top tabs (desktop) / bottom TabBar (mobile). Also includes a multi-step onboarding wizard (org → venue).

## Motivation

Bugs #2, #4, #5, #16 from QA. The current navigation is disorienting: org-level pages (Team, Services, Settings) share space awkwardly with venue-scoped pages, there's no clear spatial model for venue switching, and mobile navigation is inconsistent.

## Future Work (not in this spec)

- Bug #6: Customer app business directory
- Bug #11: Booking confirmation navigation
- Bug #12: In-app notifications for therapists
- Bug #13: Service card padding
- Bug #14: Phone placeholder locale
- Bug #15: Venue address + Google Maps
- Bug #17: Email templates (react-email)
- Bug #18: Dark mode

---

## Navigation Model

Mapping from Vercel:

| Vercel concept | OpenSchedule equivalent |
|---------------|------------------------|
| Organization | Organization (studio) |
| Project | Venue |
| Sidebar nav | Sidebar nav (Venues, Team, Services, Settings) |
| Project tabs | Venue tabs (Today, Bookings, Schedule, Settings) |

---

## Layout States

### 1. Desktop — Org Home (`/:orgSlug`)

```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar 200px]  │  [Main content — full remaining]     │
│                  │                                       │
│  🟡 Studio ▾     │  Venues          [+ Add Venue]       │
│                  │  ┌────────┐  ┌────────┐              │
│  ● Venues        │  │Downtown│  │ Uptown │              │
│    Team          │  │3 today │  │1 today │              │
│    Services      │  └────────┘  └────────┘              │
│    Settings      │                                       │
│                  │                                       │
│  ─────────       │                                       │
│  Account         │                                       │
└─────────────────────────────────────────────────────────┘
```

- **Sidebar:** persistent, 200px. Contains org logo/name (dropdown for multi-org), nav links, Account link at bottom.
- **Main content:** rendered by the active sidebar item. Default is Venues (venue card grid). Team, Services, Settings render their respective pages.
- **Role scoping:** therapists see only "Venues" in the sidebar. Owner sees all.
- **No TopBar on desktop org-home** — the sidebar handles identity and nav.

### 2. Desktop — Venue Selected (`/:orgSlug/venues/:venueSlug`)

```
┌─────────────────────────────────────────────────────────┐
│ [← 🟡]  Downtown ▾                              [👤]   │ ← TopBar
├─────────────────────────────────────────────────────────┤
│ Today │ Bookings │ Schedule │ Settings                   │ ← VenueTabs
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Tab content — full width]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Sidebar disappears** when inside a venue.
- **TopBar:** back arrow (→ `/:orgSlug`), org logo, venue name + switcher dropdown, avatar with dropdown (Account, Sign Out) on right.
- **VenueTabs:** horizontal tabs below top bar (Today, Bookings, Schedule, Settings). URL-driven active state.
- **No bottom TabBar on desktop.**

### 3. Mobile — Org Home (`/:orgSlug`)

```
┌──────────────────────────────┐
│    🟡 Studio Name ▾    [👤]  │ ← MobileTopBar
├──────────────────────────────┤
│ Venues │ Team │ Svc │ ⚙      │ ← MobileOrgNav (Link row)
├──────────────────────────────┤
│                              │
│  [venue cards / content]     │
│                              │
└──────────────────────────────┘
```

- **MobileTopBar:** centered org name + dropdown switcher, avatar right.
- **MobileOrgNav:** horizontal row of `<Link>` elements styled as tabs. Pathname-driven active state. Owner sees all 4; therapist sees only Venues.
- **No sidebar.** No bottom TabBar at org level.

### 4. Mobile — Venue Selected (`/:orgSlug/venues/:venueSlug`)

```
┌──────────────────────────────┐
│ [← 🟡]   Downtown ▾   [👤]  │ ← MobileTopBar (venue mode)
├──────────────────────────────┤
│                              │
│  [Tab content]               │
│                              │
├──────────────────────────────┤
│ Today │ Bookings │ Sched │ ⚙ │ ← Bottom TabBar
└──────────────────────────────┘
```

- **MobileTopBar:** back arrow + org logo (left), venue name + switcher (center), avatar (right).
- **Bottom TabBar:** fixed, same 4 items as current. Only visible on mobile inside a venue.
- **No sidebar.** No horizontal org-nav.

---

## Components

### New Components

| Component | Responsibility |
|-----------|---------------|
| `Sidebar` | Desktop-only (hidden `md:hidden` → visible `md:flex`). Org identity, nav links, Account link. Receives `orgSlug`, `currentPath`. Role-scoped links. |
| `MobileOrgNav` | Mobile-only (`md:hidden`). Horizontal `<Link>` row below MobileTopBar. Same links as sidebar, styled as underline-tabs. |
| `VenueTabs` | Desktop-only (`hidden md:flex`). Horizontal tab links for venue sub-pages. Shown only inside venue layout. |
| `MobileTopBar` | Top bar for mobile. Two modes: org-home (centered org name) and venue-selected (back + venue switcher). |

### Modified Components

| Component | Change |
|-----------|--------|
| `TopBar` | Becomes desktop-venue-only. Shows only when a venue is selected on desktop. Contains back arrow, venue switcher, avatar dropdown. |
| `TabBar` | Becomes mobile-venue-only (`md:hidden`). No changes to its items or logic. |
| `OrgNav` | Deleted. Replaced by `Sidebar` (desktop) + `MobileOrgNav` (mobile). |

### Deleted Components

| Component | Reason |
|-----------|--------|
| `OrgNav` | Replaced by Sidebar + MobileOrgNav |
| `VenueSwitcher` | Folded into the top bar venue name dropdown (same functionality, different placement) |

---

## Route Structure

No URL changes. The routes remain identical:

```
/(protected)/[orgSlug]/(dashboard)/           → org home (venues default)
/(protected)/[orgSlug]/(dashboard)/team       → team page
/(protected)/[orgSlug]/(dashboard)/services   → services page
/(protected)/[orgSlug]/(dashboard)/settings   → org settings
/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/          → venue Today
/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/bookings  → bookings
/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/schedule  → schedule
/(protected)/[orgSlug]/venues/[venueSlug]/settings         → venue settings
/(protected)/account                          → user account
/(protected)/onboarding                       → multi-step wizard
```

---

## Layout Files

### `(dashboard)/layout.tsx` — org-level layout

**Desktop:** renders `<Sidebar>` + main content (no top bar).
**Mobile:** renders `<MobileTopBar mode="org">` + `<MobileOrgNav>` + main content.

```
<div className="flex min-h-screen">
  <Sidebar className="hidden md:flex" />
  <div className="flex flex-1 flex-col">
    <MobileTopBar mode="org" className="md:hidden" />
    <MobileOrgNav className="md:hidden" />
    <main className="flex-1">{children}</main>
  </div>
</div>
```

### `venues/[venueSlug]/(tabs)/layout.tsx` — venue-level layout

**Desktop:** renders `<TopBar mode="venue">` + `<VenueTabs>` + content.
**Mobile:** renders `<MobileTopBar mode="venue">` + content + `<TabBar>`.

```
<div className="flex min-h-screen flex-col">
  <TopBar className="hidden md:flex" />
  <VenueTabs className="hidden md:flex" />
  <MobileTopBar mode="venue" className="md:hidden" />
  <main className="flex-1 pb-16 md:pb-0">{children}</main>
  <TabBar className="md:hidden" />
</div>
```

---

## Onboarding Wizard (Bug #2)

Multi-step flow. User creates org → immediately flows into venue creation.

### Step 1: Create Organization (existing)
- Org name + slug
- On success → step 2 (no redirect)

### Step 2: Create First Venue (new)
- Venue name + slug (auto-derived from name)
- Timezone (dropdown, default to browser tz)
- Capacity (number, default 1)
- Day start / day end (time inputs, defaults 09:00 / 17:00)
- On success → redirect to `/:orgSlug` (lands on the sidebar dashboard with the venue card visible)

### UI
- Centered card layout (same as current onboarding)
- Step indicator (1 of 2 / 2 of 2)
- Back button on step 2

---

## Bug #16: "Today" Bottom Nav Does Nothing

Root cause: the TabBar `base` is `/${orgSlug}/venues/${venueSlug}` — the "Today" tab links to `base` with `match: pathname === base`. If the user is already there, clicking does nothing visually (it's a no-op link). After this redesign, the bottom TabBar only appears inside a venue — so the "where am I?" confusion goes away.

Additionally, re-tapping "Today" when already on the Today page must: (1) scroll to top, and (2) reset the date navigator to today's date. This is the expected behavior — the tab doubles as a "jump to now" shortcut. Implementation: the Today tab link gets an `onClick` handler that, when `pathname === base`, calls `window.scrollTo(0, 0)` and resets the `selectedDate` state to `format(new Date(), "yyyy-MM-dd")`. This requires lifting the date state into a context or using a URL search param (`?date=`) so the tab click can reset it from outside the page component. Recommend the URL param approach — it's shareable and works without extra context plumbing.

---

## Role Scoping

| Role | Sidebar items (desktop) | MobileOrgNav items | Venue tabs |
|------|------------------------|-------------------|------------|
| Owner | Venues, Team, Services, Settings | Same 4 | Today, Bookings, Schedule, Settings |
| Therapist | Venues only | Venues only | Today, Bookings, Schedule (no Settings) |

Venue Settings tab: owner-only. Therapists see 3 tabs.

---

## Breakpoints

- **Mobile:** < 768px (`md` breakpoint). Sidebar hidden, MobileTopBar + MobileOrgNav/TabBar visible.
- **Desktop:** ≥ 768px. Sidebar visible, mobile components hidden.

No intermediate tablet breakpoint — just the single `md` cut.

---

## Venue Card

The org home (Venues page) shows venue cards. Each card:
- Venue name
- Today's booking count (confirmed + pending)
- Click → navigates to `/:orgSlug/venues/:venueSlug`

Owner also sees "+ Add Venue" card/button.

---

## Out of Scope

- Org switching (single-org assumed for MVP, same as current)
- Search
- Notifications bell (Bug #12 — separate spec)
- Customer app changes
- Dark mode
- Email templates
