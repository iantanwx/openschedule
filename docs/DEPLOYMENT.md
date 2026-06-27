# Production Deployment Guide

## Order of Operations

1. Google Cloud Console (credentials must exist before anything else)
2. Resend (domain verification can take time)
3. DNS / Domains (propagation delay)
4. Convex production deployment (backend must be live before apps)
5. Vercel — Web App (customer-facing, no OAuth dependency)
6. Vercel — Admin App (depends on Convex + Google OAuth redirect)
7. Post-deploy smoke test

---

## Step 1: Google Cloud Console

- [x] Create OAuth 2.0 credentials (or reuse dev credentials with prod URIs added)
- [x] Add **Authorized JavaScript origins**: `https://app.opencal.xyz`
- [x] Add **Authorized redirect URIs**:
  - `https://app.opencal.xyz/api/integrations/google/callback` (Google Calendar OAuth)
  - `https://<convex-prod-site-url>/api/auth/callback/google` (Google social login via BetterAuth)
- [x] Enable APIs: Maps JavaScript API, Places API, Maps Static API, Google Calendar API
- [x] Create or restrict API key for Maps (restrict to prod domains: admin + web)
- [x] Note down: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Maps API key

### Google Maps API Keys — What You Need

You need **one API key** that works in two contexts:

1. **Client-side (browser)** — used by `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in admin (address autocomplete) and web (static map images via `<img>` tag)
2. **Server-side (Convex actions)** — used by `GOOGLE_MAPS_API_KEY` for static map images embedded in HTML emails

These can be the **same key** or separate keys. Using one key is simpler; two keys gives you tighter restriction.

**If using one key:**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create an API key (or edit your existing one)
3. Under **Application restrictions**, choose "HTTP referrers (websites)"
4. Add referrers:
   - `https://app.opencal.xyz/*` (admin)
   - `https://opencal.xyz/*` (customer web)
5. Under **API restrictions**, restrict to:
   - Maps JavaScript API
   - Places API
   - Maps Static API
6. Use this key for BOTH `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY`

**Note:** HTTP referrer restrictions don't apply to server-side calls (Convex actions have no `Referer` header). If you want to lock down the server key separately:

**If using two keys (tighter security):**

- **Key 1 (client):** Restricted to HTTP referrers (`app.opencal.xyz/*`, `opencal.xyz/*`) → use as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Key 2 (server):** Restricted by IP (Convex's egress IPs, or unrestricted if unknown) → use as `GOOGLE_MAPS_API_KEY` on the Convex deployment

**Required APIs to enable (in APIs & Services → Library):**

| API | Used by |
|-----|---------|
| Maps JavaScript API | Admin address autocomplete (Places widget) |
| Places API | Admin address autocomplete (place details) |
| Maps Static API | Email templates (static map image) + customer web (venue map) |
| Google Calendar API | Calendar sync (already enabled if Google login works) |

## Step 2: Resend

- [x] Verify sending domain (e.g. `notifications.opencal.xyz`)
- [x] Add DNS records: SPF, DKIM, DMARC (Resend dashboard provides these)
- [x] Wait for domain verification to complete
- [x] Note down: `RESEND_API_KEY` (production key, not test)

## Step 3: DNS / Domains

- [ ] Point admin domain (e.g. `app.opencal.xyz`) to Vercel
- [ ] Point customer domain (e.g. `opencal.xyz`) to Vercel
- [ ] Verify SSL certificates are provisioned (Vercel handles this automatically)

## Step 4: Convex Production Deployment

Generate a BetterAuth secret:

```bash
openssl rand -base64 32
```

Set environment variables on the Convex production deployment (via dashboard or CLI):

| Variable | Value |
|----------|-------|
| `SITE_URL` | `https://<your-prod>.convex.site` |
| `BETTER_AUTH_SECRET` | (generated above) |
| `RESEND_API_KEY` | Production Resend key |
| `TRANSACTIONAL_FROM_EMAIL` | `noreply@notifications.opencal.xyz` |
| `GOOGLE_CLIENT_ID` | From Step 1 |
| `GOOGLE_CLIENT_SECRET` | From Step 1 |
| `APP_URL` | `https://app.opencal.xyz` |
| `WEB_URL` | `https://opencal.xyz` |
| `GOOGLE_MAPS_API_KEY` | Server-side Maps key (for static map images in emails) |

Deploy:

```bash
cd packages/convex
pnpm dlx convex deploy --prod
```

Note down the production `CONVEX_URL` and `CONVEX_SITE_URL` from the output.

## Step 5: Vercel — Web App (`apps/web`)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://<your-prod>.convex.cloud` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps key (restricted to customer domain) |

Vercel project settings:
- Root directory: `apps/web`
- Framework: Next.js (auto-detected)

## Step 6: Vercel — Admin App (`apps/admin`)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://<your-prod>.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://<your-prod>.convex.site` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps key (restricted to admin domain) |
| `APP_URL` | `https://app.opencal.xyz` |
| `GOOGLE_CLIENT_ID` | From Step 1 |
| `GOOGLE_CLIENT_SECRET` | From Step 1 |

Vercel project settings:
- Root directory: `apps/admin`
- Framework: Next.js (auto-detected)

## Step 7: Post-Deploy Smoke Test

### Auth

- [ ] Sign up with email (verify email verification flow works)
- [ ] Sign in with Google
- [ ] Create organization + venue (onboarding wizard)

### Booking Flow

- [ ] Visit customer web app, select service, therapist, time slot
- [ ] Complete booking — verify confirmation page renders
- [ ] Verify confirmation email received (check Resend logs if not)
- [ ] Verify notification appears in admin bell

### Admin Features

- [ ] Confirm booking appears on calendar
- [ ] Reschedule a booking
- [ ] Cancel a booking — verify cancellation email
- [ ] Invite a therapist — verify invitation email + acceptance flow

### Integrations

- [ ] Connect Google Calendar from Account page (full OAuth round-trip)
- [ ] Create a booking — verify Google Calendar event created
- [ ] Cancel it — verify calendar event removed

### Edge Cases

- [ ] Cancel via customer token link (from email)
- [ ] Verify dark mode works
- [ ] Verify mobile responsive layout
- [ ] Check landing page / business directory renders

---

## Rollback

If something breaks after deploy:

- **Convex:** Previous deployment is preserved. Redeploy from a known-good commit.
- **Vercel:** Use Vercel dashboard to promote a previous deployment.
- **Data:** Convex retains all data across deploys. Schema changes are additive (no destructive migrations in this project).

---

## Environment Variable Reference

| Variable | Where | Required | Default |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Admin + Web (Vercel) | Yes | — |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Admin (Vercel) | Yes | — |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Admin + Web (Vercel) | Yes | — |
| `APP_URL` | Admin (Vercel) + Convex | No | `http://localhost:3001` |
| `WEB_URL` | Convex | No | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Admin (Vercel) + Convex | Yes | — |
| `GOOGLE_CLIENT_SECRET` | Admin (Vercel) + Convex | Yes | — |
| `SITE_URL` | Convex | Yes | — |
| `BETTER_AUTH_SECRET` | Convex | Yes | — |
| `RESEND_API_KEY` | Convex | Yes | — |
| `TRANSACTIONAL_FROM_EMAIL` | Convex | No | `noreply@notifications.opencal.xyz` |
| `GOOGLE_MAPS_API_KEY` | Convex | Yes | — |
