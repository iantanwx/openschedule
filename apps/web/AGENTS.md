# apps/web

Next.js 16 customer-facing booking app.

## Skills

When working on this app, use the installed agent skills:

- **next-dev-loop** — Use when iterating on pages, layouts, or server components.
- **next-cache-components-optimizer** — Use when working with caching, RSC, or component performance.
- **next-best-practices** — Use when making architectural decisions or reviewing Next.js patterns.
- **insight-error-page** — Use when building or debugging error pages.
- **vercel-react-best-practices** — Use when writing React components, hooks, or client-side logic.
- **vercel-composition-patterns** — Use when composing components or deciding client/server boundaries.
- **building-components** — Use when building reusable UI components.
- **shadcn** — Use when adding, composing, or styling UI components.
- **agent-browser** — Use when testing pages in the browser or automating UI interactions.

## Routing

Path-based: `/:orgSlug/:venueSlug/...`

## shadcn (monorepo)

This is a monorepo. shadcn components live in `packages/ui/src/components/` but **must be installed from this directory** (`apps/web`):

```bash
cd apps/web
pnpm dlx shadcn@latest add <component>
```

The `components.json` here routes the `"ui"` alias to `@openschedule/ui/components`, so the CLI writes files to the shared package automatically. Never run `shadcn add` from `packages/ui` directly.

See: https://ui.shadcn.com/docs/monorepo#add-components-to-your-project

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind v4
- shadcn/ui (radix-nova base)
- Convex (backend via `@openschedule/convex`)
