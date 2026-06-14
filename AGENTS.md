<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Code Hygiene

- Never use non-null assertions (`!`). Narrow the type properly with guards, variables, or early returns.
- Never use `/// <reference types="..." />` directives. Add type packages to `tsconfig.json` `"types"` instead.
- Prefer `const` narrowing over inline assertions. Extract a variable, check it, then use it.

## Package Manager

This project uses **pnpm**. Always use `pnpm dlx` (not `npx`) when running one-off package binaries (e.g. `pnpm dlx skills add ...`, `pnpm dlx shadcn add ...`).

## Git

Use semantic commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `ci:`, `perf:`, `style:`.
