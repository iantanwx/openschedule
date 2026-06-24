# Business Directory Landing Page — Design Spec

## Goal

Replace the placeholder customer web app root (`/`) with a branded landing page that lets customers discover businesses via search or browse a carousel of active venues.

## Context

Currently `apps/web/app/page.tsx` is a scaffolding placeholder. Customers arrive exclusively via direct links (`/:orgSlug/:venueSlug`). There is no discovery path. This feature adds one — modeled on a lightweight version of Fresha's homepage (hero + search + business grid), scoped to a single deployment (no multi-city/country taxonomy).

---

## Schema Additions

### `organizations` table

| Field | Type | Notes |
|-------|------|-------|
| `description` | `v.optional(v.string())` | Short business tagline/description |

### `venues` table

| Field | Type | Notes |
|-------|------|-------|
| `description` | `v.optional(v.string())` | Venue-specific description |
| `coverImageId` | `v.optional(v.string())` | Convex file storage ID (same pattern as org `logoStorageId`) |

No new tables. No index changes.

---

## Backend

### New public query: `venues.listPublicDirectory`

- **Args:** none
- **Auth:** none (public)
- **Returns:** Array of venue cards:
  ```ts
  {
    _id: Id<"venues">;
    name: string;
    slug: string;
    address?: string;
    description?: string;
    coverImageUrl?: string; // resolved from coverImageId via ctx.storage.getUrl
    org: {
      _id: Id<"organizations">;
      name: string;
      slug: string;
      description?: string;
    };
  }
  ```
- **Logic:** Query all active venues, resolve their org, resolve `coverImageId` → URL via `ctx.storage.getUrl`. Limit 50 (sufficient for early stage; paginate later if needed).

### New public query: `venues.searchDirectory`

- **Args:** `{ query: v.string() }`
- **Auth:** none (public)
- **Returns:** Same shape as `listPublicDirectory`, filtered.
- **Logic:** Case-insensitive substring match on `venue.name` OR `org.name`. No full-text search engine needed at this scale. Returns first 20 matches.

### Mutations update

- `venues.create`: accept `description: v.optional(v.string())`, `coverImageId: v.optional(v.string())`
- `venues.update`: accept same two new optional fields
- `organizations.update`: accept `description: v.optional(v.string())`

---

## Customer Web App (`apps/web`)

### Route: `/` (root page)

Replace the placeholder with a server component that renders the landing page.

### Components

**`LandingHero`** — full-width hero section
- Heading: "Book wellness services nearby" (or org-appropriate copy)
- Subheading: "Discover studios and book your next appointment"
- `SearchInput` component (see below)
- Below search: small text link "Have a booking link? Paste it here" → opens a simple input that parses `/:orgSlug/:venueSlug` from a URL and navigates

**`SearchInput`** — autocomplete search
- Text input with magnifying glass icon
- On keystroke (debounced 300ms), calls `venues.searchDirectory({ query })`
- Dropdown shows matching venue cards (name + org name + address)
- Clicking a result navigates to `/${org.slug}/${venue.slug}`
- Empty state: "No businesses found"

**`BusinessCarousel`** — grid/carousel of venue cards
- Section heading: "Popular businesses" (or "Browse")
- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
- Each card = `VenueDirectoryCard`

**`VenueDirectoryCard`** — individual business card
- Cover image (240px height, object-cover) or gradient placeholder if no `coverImageUrl`
- Org name (bold)
- Venue name (if different from org name)
- Address line (muted text, truncated single line)
- Description snippet (muted, 2-line clamp)
- Entire card is a link to `/${org.slug}/${venue.slug}`

**`PasteLinkInput`** — secondary helper (shown on toggle)
- Simple text input + "Go" button
- Parses the URL path, extracts orgSlug/venueSlug, navigates
- Validates format, shows error if invalid

---

## Admin App Updates

### Venue Settings Page

Add below existing fields:
- **Description** — textarea, optional, max 200 chars
- **Cover Image** — file upload using existing `generateUploadUrl` pattern (same as org logo). Shows preview thumbnail when uploaded. "Remove" button to clear.

### Onboarding (Step 2: Venue)

Add optional description textarea (same field, no image upload during onboarding — keep it lean).

### Org Settings Form

Add **Description** textarea field (optional, max 200 chars).

---

## Data Flow

```
Customer lands on /
  → LandingHero renders (static copy)
  → BusinessCarousel calls venues.listPublicDirectory (reactive via useQuery)
  → Cards render with cover images from Convex storage

Customer types in SearchInput
  → debounced venues.searchDirectory({ query })
  → dropdown shows results
  → click → router.push(/${orgSlug}/${venueSlug})

Customer pastes a link
  → PasteLinkInput parses path
  → navigates to extracted route
```

---

## Error Handling

- `listPublicDirectory` returns empty array → show "No businesses registered yet" message
- `searchDirectory` returns empty → show "No results for {query}"
- `PasteLinkInput` invalid URL → inline error "Invalid booking link format"
- Missing cover image → render gradient placeholder (zinc-100 → zinc-200)

---

## Out of Scope

- Customer accounts / auth
- Geolocation-based sorting
- Multi-city/country taxonomy
- Reviews/ratings
- Service-type filtering on landing page
- SEO/meta tags (defer to a follow-up)
- Pagination (limit 50 venues is sufficient for now)

---

## Testing

- Backend: unit test `listPublicDirectory` returns correct shape; `searchDirectory` filters correctly
- Frontend: typecheck only (no FE test framework). E2E via agent-browser — verify search works, cards link correctly, paste-link navigates.
