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

## Full ID Generation Architecture

Three layers can produce an ID. Understanding how they interact explains both the bug and the fix.

### Layer 1: Adapter Factory (`@better-auth/core/dist/db/adapter/factory.mjs`)

The `create()` method has a `forceAllowId` guard:

```js
create: async ({ data, model, forceAllowId = false }) => {
  if ("id" in data && typeof data.id !== "undefined" && !forceAllowId) {
    logger.warn("You are trying to create a record with an id. This is not allowed...");
    data.id = void 0;  // STRIPS the id
  }
  data = await transformInput(data, model, "create", forceAllowId);
}
```

- `forceAllowId: false` (default) → factory strips any `id` field with a warning
- `forceAllowId: true` → factory trusts the caller and keeps `id` intact

`createWithHooks` (the internal adapter's write path) **always** passes `forceAllowId: true`:

```js
// with-hooks.mjs:25-28
async function createWithHooks(data, model, customCreateFn) {
  created = await adapter.create({
    model,
    data: actualData,
    forceAllowId: true   // always trusted from internal adapter
  });
}
```

So anything going through the internal adapter is trusted to include its own ID.

### Layer 2: Factory `defaultValue` for the ID field (`get-id-field.mjs`)

The factory attaches a `defaultValue()` function to the `id` field. During `transformInput`, if `id` is `undefined`, it calls `defaultValue()` to fill it:

```js
const shouldGenerateId = (() => {
  if (disableIdGeneration) return false;   // Convex sets this
  else if (useNumberId && !forceAllowId) return false;
  else if (useUUIDs) return !supportsUUIDs;
  else return true;
})();

// Only attached when shouldGenerateId is true:
...shouldGenerateId ? { defaultValue() {
  if (disableIdGeneration) return void 0;
  const generateId = options.advanced?.database?.generateId;
  if (typeof generateId === "function") return generateId({ model });
  if (generateId === "uuid") return crypto.randomUUID();
  return generateId();  // fallback: random 32-char alphanumeric
} } : {}
```

Convex disables this via `disableIdGeneration: true` → `shouldGenerateId = false` → no `defaultValue` attached → `id` stays `undefined` → Convex generates `_id` server-side. This is mechanism #1 from above.

### Layer 3: `context.generateId()` — Plugin-Level

Plugins call this explicitly when they want to pre-generate IDs. Controlled by `options.advanced.database.generateId`:

| Value | Returns |
|-------|---------|
| `undefined` (default) | nanoid string |
| `"uuid"` | `crypto.randomUUID()` |
| `"serial"` | `false` |
| `false` | `false` |
| custom function | calls it |

The org plugin:
```js
const invitationId = context.generateId({ model: "invitation" });
data: { ...invitationId !== false ? { id: invitationId } : {}, ...rest }
```

When it returns a string, `{ id: "xxx" }` is spread in. When `false`, empty spread. This is mechanism #2.

### Layer 4: The Database (Convex)

When no `_id` is present in the data arriving at the Convex component's `create` mutation, Convex auto-generates one server-side. This is the intended path for the Convex adapter.

### Complete Flow (Normal — No Pre-Generated ID)

```
Plugin/Route (e.g., sign-up)
  → internalAdapter.createUser({ email, name, ... })  [no id field]
    → createWithHooks(data, "user")
      → adapter.create({ model, data, forceAllowId: true })
        → transformInput(): disableIdGeneration=true → no defaultValue → id undefined
        → mapKeysTransformInput: { id: "_id" } → _id also undefined, omitted
        → adapterInstance.create({ model, data })  [no _id in data]
          → ctx.runMutation(api.adapter.create, { input: { model, data } })
            → Convex generates _id server-side
            → returns doc with _id
        → mapKeysTransformOutput: { _id: "id" } → renames back for better-auth
```

### Complete Flow (Bug — Plugin Pre-Generates ID)

```
Org plugin inviteMember
  → context.generateId({ model: "invitation" })  → returns "bxTVEz..."
  → adapter.create({ model: "invitation", data: { id: "bxTVEz...", ... }, forceAllowId: true })
    → transformInput(): forceAllowId=true → keeps id
    → mapKeysTransformInput: { id: "_id" } → _id = "bxTVEz..."
    → adapterInstance.create({ model, data: { _id: "bxTVEz...", ... } })
      → ctx.runMutation(api.adapter.create, { input: { model, data } })
        → Convex validator REJECTS: _id not in schema fields
        → 500 error
```

### Complete Flow (Fixed — `generateId: false`)

```
Org plugin inviteMember
  → context.generateId({ model: "invitation" })  → returns false
  → { ...false !== false ? { id: false } : {} }  → empty spread, no id field
  → adapter.create({ model: "invitation", data: { status, email, ... }, forceAllowId: true })
    → transformInput(): disableIdGeneration=true → no defaultValue → id undefined
    → mapKeysTransformInput → _id undefined, omitted
    → adapterInstance.create({ model, data })  [no _id]
      → Convex generates _id server-side ✓
```

## Key Takeaway

The `@convex-dev/better-auth` adapter correctly disables ID generation at the factory level (`disableIdGeneration: true`) but doesn't address the context-level `generateId()` that plugins can call explicitly. Setting `advanced.database.generateId = false` tells the context-level function to return `false`, which plugins are expected to handle (the org plugin does via the `!== false` ternary).

This is likely why the organization plugin isn't on the Convex adapter's supported plugins list — but the fix is trivial.

## References

- Open bug: https://github.com/better-auth/better-auth/issues/10024
