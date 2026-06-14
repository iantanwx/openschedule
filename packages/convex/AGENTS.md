<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Typing Rules

- **Single source of truth:** Always use Convex generated types (`Doc<"tableName">`, `Id<"tableName">`) from `src/_generated/dataModel`. Never define custom interfaces that duplicate schema fields.
- **DTOs via `Pick<>`:** When a function needs only a subset of a document's fields, derive the type using `Pick<Doc<"tableName">, "field1" | "field2">`. This ensures type changes in the schema propagate automatically.
- **DTO file structure:** Split per domain, per command/query:
  - `src/types/{domain}.queries.ts` — return shapes for queries (what upstream consumers see)
  - `src/types/{domain}.mutations.ts` — input shapes for mutations
- **Internal lib types:** Colocate with their module (e.g. slot computation types live in `src/lib/slots.ts`), still derived from `Doc<>`.
- **Computed output types:** Types that represent computed results (not documents) may be defined as plain interfaces (e.g. `TimeSlot`), but should never mirror existing schema fields.
- **Exports:** The `types/` directory is exported for upstream app consumers via package.json exports.

## Date/Time

- Use `date-fns` and `date-fns-tz` for date operations (generating ranges, day-of-week, timezone conversions).
- Custom "HH:MM" string utilities (`timeToMinutes`, `minutesToTime`, `timeRangesOverlap`) are domain-specific and live in `src/lib/time.ts`.

## Code Organization

- Queries go in `src/queries/{domain}.ts`
- Mutations go in `src/mutations/{domain}.ts`
- Actions go in `src/actions/{domain}.ts`
- Pure logic/helpers go in `src/lib/`
- Tests go in `src/tests/`
