# better-auth Organization Plugin + Convex: ID Generation Fix

## Problem

The better-auth organization plugin's `inviteMember` endpoint returns 500 when used with the Convex adapter. The error is:

```
ArgumentValidationError: Value does not match validator.
Path: .input
```

The root cause: the org plugin passes an `id` field into the adapter's `create` call for invitations, which gets mapped to `_id` by the Convex adapter's key transform, but the Convex component's `create` mutation validator doesn't include `_id` in its accepted fields.

## Root Cause Analysis

There are **two parallel ID generation mechanisms** in better-auth:

### Mechanism 1: Adapter Factory Field Attributes

Defined in `@better-auth/core/dist/db/adapter/get-id-field.mjs`. The adapter factory can define a `defaultValue()` generator for the `id` field that silently prepends an ID to every create operation.

The Convex adapter (`@convex-dev/better-auth/src/client/adapter.ts`) disables this via:

```ts
createAdapterFactory({
  config: {
    disableIdGeneration: true,  // prevents factory from injecting id
  }
})
```

This is consumed in `get-id-field.mjs`:

```js
const shouldGenerateId = (() => {
    if (disableIdGeneration) return false;
    // ...
})();
```

### Mechanism 2: `context.generateId()` — Plugin-Level

A separate function on the auth context, defined in `better-auth/dist/context/create-context.mjs`:

```js
const generateIdFunc = ({ model, size }) => {
    const dbGenerateId = options?.advanced?.database?.generateId;
    if (typeof dbGenerateId === "function") return dbGenerateId({ model, size });
    if (dbGenerateId === "uuid") return crypto.randomUUID();
    if (dbGenerateId === "serial" || dbGenerateId === false) return false;
    return generateId(size);  // ← default: nanoid string
};
```

Plugins call this directly when they want explicit IDs. The org plugin does this for invitations:

```js
// better-auth/dist/plugins/organization/adapter.mjs:607
const invitationId = context.generateId({ model: "invitation" });
return await adapter.create({
    model: "invitation",
    data: {
        ...invitationId !== false ? { id: invitationId } : {},
        status: "pending",
        expiresAt,
        createdAt: new Date(),
        inviterId: user.id,
        ...invitation,
    },
    forceAllowId: true
});
```

When `generateId` returns a string, `{ id: "xxx" }` is spread into data. The Convex adapter's `mapKeysTransformInput: { id: "_id" }` then renames it to `_id`. The component's `create` mutation validator rejects because `_id` isn't in the schema fields.

### Why Users/Orgs/Sessions Work

- **User creation** (`sign-up.mjs`): calls `internalAdapter.createUser({ email, name, ... })` — no `id` field. The `generateId` call at line 176 is only used for a synthetic response (timing-attack mitigation), never inserted.
- **Org creation** (`crud-org.mjs`): passes `{ name, slug, createdAt }` — no explicit `id`.
- **Session creation** (`internal-adapter.mjs`): only generates a session ID when `secondaryStorage` is enabled (we don't use it).

Only the invitation path in the org plugin explicitly generates and includes an ID.

## Fix

Set `advanced.database.generateId = false` in the better-auth options:

```ts
// packages/convex/src/betterAuth/auth.ts
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    // ...existing options...
    advanced: {
      database: {
        generateId: false,  // ← Convex manages its own _id
      },
    },
  } satisfies BetterAuthOptions;
};
```

### Impact Analysis

| Call site | File | Current | After fix | Safe? |
|-----------|------|---------|-----------|-------|
| Invitation | `plugins/organization/adapter.mjs:607` | Returns nanoid → `{ id: "xxx" }` → mapped to `_id` → **REJECTED** | Returns `false` → empty spread → no `id` → Convex auto-generates `_id` → **WORKS** | ✓ |
| Session | `db/internal-adapter.mjs:171` | Only runs with `secondaryStorage` (unused) | N/A | ✓ |
| User (sign-up synthetic) | `api/routes/sign-up.mjs:176` | `false \|\| generateId()` → fallback generates string for JSON response only, never inserted | Same — synthetic response still works | ✓ |

### Why This Is Safe

- Convex always auto-generates document IDs (`_id`). External IDs are not needed or desired.
- The Convex adapter already sets `disableIdGeneration: true` for mechanism #1 — this fix completes the story for mechanism #2.
- The `false || generateId()` fallback in sign-up ensures the synthetic user response still has an ID (it's just a response, never inserted).
- No patch to `@convex-dev/better-auth` is needed.

### Cleanup

After applying this fix, remove:
- `patches/@convex-dev__better-auth@0.12.4.patch` (no longer needed)
- The `patchedDependencies` entry in `pnpm-workspace.yaml`

## Key Takeaway

The `@convex-dev/better-auth` adapter correctly disables ID generation at the factory level (`disableIdGeneration: true`) but doesn't address the context-level `generateId()` that plugins can call explicitly. Setting `advanced.database.generateId = false` tells the context-level function to return `false`, which plugins are expected to handle (the org plugin does via the `!== false` ternary).

This is likely why the organization plugin isn't on the Convex adapter's supported plugins list — but the fix is trivial.
