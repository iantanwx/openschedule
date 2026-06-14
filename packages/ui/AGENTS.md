# packages/ui

Shared UI component library based on shadcn/ui (radix-nova).

## Skills

When working on this package, use the installed agent skills:

- **shadcn** — Use when adding, composing, customizing, or debugging components.
- **building-components** — Use when building reusable UI components.
- **vercel-react-best-practices** — Use when writing React components or hooks.
- **vercel-composition-patterns** — Use when composing components or deciding boundaries.

## shadcn (monorepo)

Components in this package are managed via shadcn CLI, but **must be installed from `apps/web`**, not from here:

```bash
cd apps/web
pnpm dlx shadcn@latest add <component>
```

The `apps/web/components.json` routes the `"ui"` alias to this package (`@openschedule/ui/components`), so the CLI writes files here automatically.

See: https://ui.shadcn.com/docs/monorepo#add-components-to-your-project

## Stack

- React 19
- Tailwind v4
- shadcn/ui (radix-nova base, `components.json` present)
- Radix UI primitives
- cva (class-variance-authority) for variant composition
- Lucide React for icons
