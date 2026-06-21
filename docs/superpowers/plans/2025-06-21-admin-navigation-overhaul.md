# Admin Navigation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the admin app navigation from flat TopBar + OrgNav + bottom TabBar to a responsive Vercel-style layout: persistent sidebar on desktop, horizontal link-tabs on mobile. Venue selection transitions from sidebar/list view to a focused venue detail with top tabs (desktop) / bottom TabBar (mobile). Also includes a multi-step onboarding wizard (org → venue) and Bug #16 fix (Today tab scroll-to-top + jump-to-today).

**Architecture:** Responsive dual-layout system — org-level uses Sidebar (desktop) + MobileOrgNav (mobile); venue-level uses TopBar+VenueTabs (desktop) + MobileTopBar+TabBar (mobile). Single `md` (768px) breakpoint separates the two. Role-scoped nav links (owner sees all, therapist sees Venues only at org level, no Settings at venue level).

**Tech Stack:** Next.js 16 (App Router), React 19, Convex, shadcn/ui, Tailwind CSS 4, lucide-react, date-fns

---

## File Structure

### New Components
- `apps/admin/lib/nav-links.ts` — Shared org nav link definitions (label, icon, href builder, ownerOnly). Used by Sidebar + MobileOrgNav.
- `apps/admin/lib/venue-tab-links.ts` — Shared venue tab definitions (label, icon, match fn, ownerOnly). Used by VenueTabs + TabBar.
- `apps/admin/components/sidebar.tsx` — Desktop-only org sidebar
- `apps/admin/components/mobile-top-bar.tsx` — Mobile top bar (two modes: org/venue)
- `apps/admin/components/mobile-org-nav.tsx` — Mobile horizontal org nav tabs
- `apps/admin/components/venue-tabs.tsx` — Desktop-only venue sub-page tabs

### Modified Files
- `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx` — New dual-layout with Sidebar + MobileTopBar + MobileOrgNav
- `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx` — New venue layout with TopBar + VenueTabs + MobileTopBar + TabBar
- `apps/admin/components/top-bar.tsx` — Desktop-venue-only, back arrow + venue switcher dropdown + avatar
- `apps/admin/components/tab-bar.tsx` — Mobile-venue-only (`md:hidden`), add role scoping
- `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx` — Remove standalone TopBar render
- `apps/admin/app/(protected)/onboarding/page.tsx` — Multi-step wizard (org → venue)
- `apps/admin/components/today-page.tsx` — URL-driven date, scroll-to-top on re-tap

### Deleted Files
- `apps/admin/components/org-nav.tsx` — Replaced by Sidebar + MobileOrgNav
- `apps/admin/components/venue-switcher.tsx` — Functionality folded into TopBar dropdown

---

## Task 1: Create Sidebar Component

**Files:**
- Create: `apps/admin/components/sidebar.tsx`

- [ ] **Step 1: Create `apps/admin/components/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { useActiveOrganization } from "@/lib/auth-client";
import { MapPin, Users, Layers, Settings, User } from "lucide-react";

interface SidebarProps {
  className?: string;
}

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly: boolean;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const { data: activeOrg } = useActiveOrganization();
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;
  const orgName = activeOrg?.name ?? orgSlug;

  const links: NavLink[] = [
    { label: "Venues", href: `/${orgSlug}`, icon: MapPin, ownerOnly: false },
    { label: "Team", href: `/${orgSlug}/team`, icon: Users, ownerOnly: true },
    { label: "Services", href: `/${orgSlug}/services`, icon: Layers, ownerOnly: true },
    { label: "Settings", href: `/${orgSlug}/settings`, icon: Settings, ownerOnly: true },
  ];

  const visibleLinks = links.filter((link) => !link.ownerOnly || isOwner);

  function isActive(href: string): boolean {
    // Venues link is active when on the org root or any path not matching other nav items
    if (href === `/${orgSlug}`) {
      return pathname === `/${orgSlug}` || pathname === `/${orgSlug}/`;
    }
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={`flex w-[200px] flex-col border-r bg-muted/30 ${className ?? ""}`}
    >
      {/* Org identity */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold">
          {orgName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold truncate">{orgName}</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-3">
        {visibleLinks.map((link) => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Account link at bottom */}
      <div className="border-t p-3">
        <Link
          href="/account"
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/account")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Account
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/sidebar.tsx
git commit -m "feat: create Sidebar component for desktop org navigation"
```

---

## Task 2: Create MobileTopBar Component

**Files:**
- Create: `apps/admin/components/mobile-top-bar.tsx`

- [ ] **Step 1: Create `apps/admin/components/mobile-top-bar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization, useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { ArrowLeft, ChevronDown, Settings, LogOut } from "lucide-react";

interface MobileTopBarProps {
  mode: "org" | "venue";
  className?: string;
}

export function MobileTopBar({ mode, className }: MobileTopBarProps) {
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org && mode === "venue" ? { orgId: org._id } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  function handleVenueSwitch(targetSlug: string) {
    router.push(`/${orgSlug}/venues/${targetSlug}`);
  }

  if (mode === "org") {
    return (
      <header className={`flex h-14 items-center justify-between border-b px-4 ${className ?? ""}`}>
        <div />
        <span className="text-sm font-semibold">{orgName}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    );
  }

  // mode === "venue"
  const venueName = venue?.name ?? venueSlug;
  const hasMultipleVenues = venues && venues.length > 1;

  return (
    <header className={`flex h-14 items-center justify-between border-b px-4 ${className ?? ""}`}>
      {/* Left: back arrow + org logo */}
      <div className="flex items-center gap-2">
        <Link
          href={`/${orgSlug}`}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Back to organization"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-[10px] font-bold">
          {orgName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Center: venue name + switcher */}
      <div className="flex items-center gap-1">
        {hasMultipleVenues ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80">
              {venueName}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {venues.map((v) => (
                <DropdownMenuItem
                  key={v._id}
                  onClick={() => handleVenueSwitch(v.slug)}
                  className={v.slug === venueSlug ? "font-semibold" : ""}
                >
                  {v.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-medium">{venueName}</span>
        )}
      </div>

      {/* Right: avatar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/mobile-top-bar.tsx
git commit -m "feat: create MobileTopBar component with org and venue modes"
```

---

## Task 3: Create MobileOrgNav Component

**Files:**
- Create: `apps/admin/components/mobile-org-nav.tsx`

- [ ] **Step 1: Create `apps/admin/components/mobile-org-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { MapPin, Users, Layers, Settings } from "lucide-react";

interface MobileOrgNavProps {
  className?: string;
}

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly: boolean;
}

export function MobileOrgNav({ className }: MobileOrgNavProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const currentUser = useQuery(convexApi.queries.users.getSelf);

  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const links: NavLink[] = [
    { label: "Venues", href: `/${orgSlug}`, icon: MapPin, ownerOnly: false },
    { label: "Team", href: `/${orgSlug}/team`, icon: Users, ownerOnly: true },
    { label: "Services", href: `/${orgSlug}/services`, icon: Layers, ownerOnly: true },
    { label: "Settings", href: `/${orgSlug}/settings`, icon: Settings, ownerOnly: true },
  ];

  const visibleLinks = links.filter((link) => !link.ownerOnly || isOwner);

  function isActive(href: string): boolean {
    if (href === `/${orgSlug}`) {
      return pathname === `/${orgSlug}` || pathname === `/${orgSlug}/`;
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className={`flex items-center gap-1 overflow-x-auto border-b px-4 ${className ?? ""}`}>
      {visibleLinks.map((link) => {
        const active = isActive(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              active
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/mobile-org-nav.tsx
git commit -m "feat: create MobileOrgNav component for mobile org-level tabs"
```

---

## Task 4: Create VenueTabs Component

**Files:**
- Create: `apps/admin/components/venue-tabs.tsx`

- [ ] **Step 1: Create `apps/admin/components/venue-tabs.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface VenueTabsProps {
  className?: string;
}

interface TabLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

export function VenueTabs({ className }: VenueTabsProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const tabs: TabLink[] = [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (p, b) => p === b || p === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (p, b) => p.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (p, b) => p.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (p, b) => p.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <nav className={`border-b px-4 ${className ?? ""}`}>
      <ul className="flex items-center gap-1">
        {visibleTabs.map((tab) => {
          const active = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/components/venue-tabs.tsx
git commit -m "feat: create VenueTabs component for desktop venue sub-page navigation"
```

---

## Task 5: Rewrite (dashboard)/layout.tsx

**Files:**
- Modify: `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx`

- [ ] **Step 1: Rewrite `apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx`**

Replace the entire file with:

```tsx
import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { MobileOrgNav } from "@/components/mobile-org-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <MobileTopBar mode="org" className="md:hidden" />
        <MobileOrgNav className="md:hidden" />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/(protected)/[orgSlug]/(dashboard)/layout.tsx
git commit -m "feat: rewrite dashboard layout with Sidebar + MobileTopBar + MobileOrgNav"
```

---

## Task 6: Rewrite Venue (tabs)/layout.tsx + Modify TopBar + Modify TabBar

**Files:**
- Modify: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx`
- Modify: `apps/admin/components/top-bar.tsx`
- Modify: `apps/admin/components/tab-bar.tsx`

- [ ] **Step 1: Rewrite `apps/admin/components/top-bar.tsx` as desktop-venue-only**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useActiveOrganization, useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { ArrowLeft, ChevronDown, Settings, LogOut } from "lucide-react";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );
  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const venueName = venue?.name ?? venueSlug;
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasMultipleVenues = venues && venues.length > 1;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  function handleVenueSwitch(targetSlug: string) {
    router.push(`/${orgSlug}/venues/${targetSlug}`);
  }

  return (
    <header className={`flex h-14 items-center justify-between border-b px-4 ${className ?? ""}`}>
      {/* Left: back arrow + org logo + venue switcher */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${orgSlug}`}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Back to organization"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold">
          {orgName.charAt(0).toUpperCase()}
        </div>
        <div className="flex items-center gap-1">
          {hasMultipleVenues ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80">
                {venueName}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {venues.map((v) => (
                  <DropdownMenuItem
                    key={v._id}
                    onClick={() => handleVenueSwitch(v.slug)}
                    className={v.slug === venueSlug ? "font-semibold" : ""}
                  >
                    {v.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm font-medium">{venueName}</span>
          )}
        </div>
      </div>

      {/* Right: avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 2: Modify `apps/admin/components/tab-bar.tsx` to be mobile-venue-only with role scoping**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b || pathname === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];
}

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background ${className ?? ""}`}>
      <ul className="flex h-16 items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 3: Rewrite `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx`**

Replace the entire file with:

```tsx
import { TopBar } from "@/components/top-bar";
import { VenueTabs } from "@/components/venue-tabs";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { TabBar } from "@/components/tab-bar";

export default function VenueTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar className="hidden md:flex" />
      <VenueTabs className="hidden md:flex" />
      <MobileTopBar mode="venue" className="md:hidden" />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <TabBar className="md:hidden" />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/(tabs)/layout.tsx apps/admin/components/top-bar.tsx apps/admin/components/tab-bar.tsx
git commit -m "feat: rewrite venue layout with TopBar + VenueTabs (desktop) and MobileTopBar + TabBar (mobile)"
```

---

## Task 7: Venue Settings Page Layout Fix

**Files:**
- Modify: `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx`

The venue settings page currently renders its own `<TopBar />` since it lives outside the `(tabs)` route group. It needs its own complete layout matching the venue pattern (TopBar + VenueTabs on desktop, MobileTopBar + TabBar on mobile).

- [ ] **Step 1: Rewrite `apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx`**

Replace the entire file with:

```tsx
import { use } from "react";
import { TopBar } from "@/components/top-bar";
import { VenueTabs } from "@/components/venue-tabs";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { TabBar } from "@/components/tab-bar";
import { VenueSettingsPage } from "@/components/venue-settings-page";

export default function VenueSettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; venueSlug: string }>;
}) {
  const { orgSlug, venueSlug } = use(params);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar className="hidden md:flex" />
      <VenueTabs className="hidden md:flex" />
      <MobileTopBar mode="venue" className="md:hidden" />
      <main className="flex-1 pb-16 md:pb-0">
        <VenueSettingsPage orgSlug={orgSlug} venueSlug={venueSlug} />
      </main>
      <TabBar className="md:hidden" />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/(protected)/[orgSlug]/venues/[venueSlug]/settings/page.tsx
git commit -m "fix: venue settings page uses new responsive layout pattern"
```

---

## Task 8: Delete OrgNav + VenueSwitcher

**Files:**
- Delete: `apps/admin/components/org-nav.tsx`
- Delete: `apps/admin/components/venue-switcher.tsx`

These components are no longer imported anywhere after the layout rewrites. The Sidebar and MobileOrgNav replace OrgNav; the venue switcher dropdown is now inline in TopBar and MobileTopBar.

- [ ] **Step 1: Delete `apps/admin/components/org-nav.tsx`**

```bash
rm apps/admin/components/org-nav.tsx
```

- [ ] **Step 2: Delete `apps/admin/components/venue-switcher.tsx`**

```bash
rm apps/admin/components/venue-switcher.tsx
```

- [ ] **Step 3: Verify no remaining imports**

Search for any lingering imports of the deleted components:

```bash
grep -r "org-nav\|venue-switcher" apps/admin/ --include="*.tsx" --include="*.ts"
```

If any results appear, remove those import lines. After the layout rewrites in Tasks 5-7, there should be none.

- [ ] **Step 4: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 5: Commit**

```bash
git add -A apps/admin/components/org-nav.tsx apps/admin/components/venue-switcher.tsx
git commit -m "chore: delete OrgNav and VenueSwitcher (replaced by Sidebar + inline dropdowns)"
```

---

## Task 9: Onboarding Wizard (Multi-Step: Org → Venue)

**Files:**
- Modify: `apps/admin/app/(protected)/onboarding/page.tsx`

The current onboarding is single-step (org creation only). This task adds a second step for venue creation with a step indicator and back button.

- [ ] **Step 1: Rewrite `apps/admin/app/(protected)/onboarding/page.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";
import { ArrowLeft } from "lucide-react";

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

function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.includes(tz)) return tz;
  } catch {
    // fallback below
  }
  return "America/New_York";
}

export default function OnboardingPage() {
  const router = useRouter();
  const createVenue = useMutation(convexApi.mutations.venues.create);

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

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

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
      setOrgId(result.data.id);
      setStep(2);
    }
  }

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setError(null);
    setLoading(true);

    try {
      await createVenue({
        orgId: orgId as any,
        name: venueName,
        slug: venueSlug,
        timezone,
        capacity,
        dayStart,
        dayEnd,
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
                  admin.openschedule.com/{orgSlug || "your-org"}
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
                <Button type="submit" className="flex-1" disabled={loading}>
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
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/(protected)/onboarding/page.tsx
git commit -m "feat: multi-step onboarding wizard (org creation → venue creation)"
```

---

## Task 10: Bug #16 — Today Tab Scroll-to-Top + Jump-to-Today

**Files:**
- Modify: `apps/admin/components/today-page.tsx`
- Modify: `apps/admin/components/tab-bar.tsx`
- Modify: `apps/admin/components/venue-tabs.tsx`

When the user re-taps "Today" while already on the Today page, the app should: (1) scroll to top, (2) reset the date to today. Implementation uses URL search param `?date=` so the Today link navigates to the base path (no `?date`), which the page interprets as "today".

- [ ] **Step 1: Modify `apps/admin/components/today-page.tsx` to use URL search params for date**

Replace the entire file with:

```tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { TimeGrid } from "./time-grid";
import { DayNav } from "./day-nav";
import { BookingDetailModal } from "./booking-detail-modal";
import { Fab } from "./fab";
import { ViewToggle } from "./view-toggle";
import { Badge } from "@openschedule/ui/components/badge";

interface TodayPageProps {
  orgSlug: string;
  venueSlug: string;
}

export function TodayPage({ orgSlug, venueSlug }: TodayPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive date from URL search param, default to today
  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ?? format(new Date(), "yyyy-MM-dd");

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const bookings = useQuery(
    convexApi.queries.bookings.listByVenueAndDate,
    venue ? { venueId: venue._id, date: selectedDate } : "skip",
  );

  const isTherapist = currentUser?.roles.includes("therapist") ?? false;
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  // For therapists in "my" view, filter to only their bookings
  const displayedBookings = useMemo(() => {
    if (!bookings) return [];
    if (isOwner || (isTherapist && viewScope === "all")) {
      return bookings;
    }
    // Therapist "my" view
    if (isTherapist && currentUser) {
      return bookings.filter((b) => b.therapistId === currentUser._id);
    }
    return bookings;
  }, [bookings, isOwner, isTherapist, viewScope, currentUser]);

  // Read-only mode: therapist viewing "all"
  const isReadOnly = isTherapist && viewScope === "all";

  // Scroll to top when date resets (navigating to base without ?date)
  useEffect(() => {
    if (!dateParam) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [dateParam]);

  const handlePrev = useCallback(() => {
    const newDate = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    router.replace(`${pathname}?date=${newDate}`, { scroll: false });
  }, [selectedDate, router, pathname]);

  const handleNext = useCallback(() => {
    const newDate = format(addDays(selectedDate, 1), "yyyy-MM-dd");
    router.replace(`${pathname}?date=${newDate}`, { scroll: false });
  }, [selectedDate, router, pathname]);

  if (org === undefined || venue === undefined) {
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

  if (!venue) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Venue not found.</p>
      </div>
    );
  }

  const activeBookings = displayedBookings.filter((b) => b.status !== "cancelled");
  const confirmedCount = activeBookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = activeBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="flex h-full flex-col">
      {/* Day nav */}
      <DayNav date={selectedDate} onPrev={handlePrev} onNext={handleNext} />

      {/* View toggle + stats banner */}
      <div className="flex items-center gap-2 px-4 pb-2">
        {isTherapist && (
          <ViewToggle value={viewScope} onChange={setViewScope} />
        )}
        <Badge variant="secondary">{activeBookings.length} bookings</Badge>
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
          {confirmedCount} confirmed
        </Badge>
        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
          {pendingCount} pending
        </Badge>
      </div>

      {/* Time grid */}
      <TimeGrid
        bookings={displayedBookings}
        dayStart={venue.dayStart}
        dayEnd={venue.dayEnd}
        onBookingTap={setSelectedBookingId}
      />

      {/* FAB */}
      {!isReadOnly && <Fab orgSlug={orgSlug} venueId={venue._id} />}

      {/* Booking detail modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          venueId={venue._id}
          readOnly={isReadOnly}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update TabBar "Today" link to handle re-tap (scroll to top + reset date)**

In `apps/admin/components/tab-bar.tsx`, replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

function buildTabs(base: string): Tab[] {
  return [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (pathname, b) => pathname === b || pathname === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (pathname, b) => pathname.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (pathname, b) => pathname.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (pathname, b) => pathname.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];
}

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;
  const tabs = buildTabs(base);

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  function handleTodayClick(e: React.MouseEvent, tab: Tab) {
    if (tab.label === "Today" && tab.match(pathname, base)) {
      e.preventDefault();
      // Already on Today — navigate to base (no ?date), triggering scroll-to-top + reset
      router.push(base);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background ${className ?? ""}`}>
      <ul className="flex h-16 items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                onClick={(e) => handleTodayClick(e, tab)}
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 3: Update VenueTabs "Today" link to handle re-tap**

In `apps/admin/components/venue-tabs.tsx`, replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Calendar, List, Clock, Settings } from "lucide-react";

interface VenueTabsProps {
  className?: string;
}

interface TabLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
  ownerOnly: boolean;
}

export function VenueTabs({ className }: VenueTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;
  const base = `/${orgSlug}/venues/${venueSlug}`;

  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const tabs: TabLink[] = [
    {
      label: "Today",
      href: base,
      icon: Calendar,
      match: (p, b) => p === b || p === `${b}/`,
      ownerOnly: false,
    },
    {
      label: "Bookings",
      href: `${base}/bookings`,
      icon: List,
      match: (p, b) => p.startsWith(`${b}/bookings`),
      ownerOnly: false,
    },
    {
      label: "Schedule",
      href: `${base}/schedule`,
      icon: Clock,
      match: (p, b) => p.startsWith(`${b}/schedule`),
      ownerOnly: false,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      match: (p, b) => p.startsWith(`${b}/settings`),
      ownerOnly: true,
    },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  function handleTodayClick(e: React.MouseEvent, tab: TabLink) {
    if (tab.label === "Today" && tab.match(pathname, base)) {
      e.preventDefault();
      router.push(base);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className={`border-b px-4 ${className ?? ""}`}>
      <ul className="flex items-center gap-1">
        {visibleTabs.map((tab) => {
          const active = tab.match(pathname, base);
          const Icon = tab.icon;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                onClick={(e) => handleTodayClick(e, tab)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter admin typecheck
```

Expected: PASS (only 2 pre-existing errors from packages/convex).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/today-page.tsx apps/admin/components/tab-bar.tsx apps/admin/components/venue-tabs.tsx
git commit -m "fix: Bug #16 — Today tab re-tap scrolls to top and resets date to today"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run typecheck**

```bash
pnpm --filter admin typecheck
```

Expected output: Only 2 pre-existing errors from `packages/convex`:
- `auth.ts:14` — authComponent
- `triggers.ts:3` — onCreate

Any other errors must be fixed before proceeding.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Fix any lint errors that appear in newly created/modified files.

- [ ] **Step 3: Verify no dead imports**

```bash
grep -r "org-nav\|venue-switcher" apps/admin/ --include="*.tsx" --include="*.ts"
```

Expected: No results.

- [ ] **Step 4: Review git status**

```bash
git status
git log --oneline -11
```

Verify all 10 commits are present (Tasks 1-10) with clean semantic messages.

- [ ] **Step 5: Final commit (if lint/cleanup needed)**

```bash
git add -A
git commit -m "chore: final lint fixes for admin navigation overhaul"
```

Only create this commit if there were lint fixes needed in Step 2.
