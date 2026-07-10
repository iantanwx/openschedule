# Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add informational payment methods (bank account, QR code) at the org level, configurable per venue, displayed in booking confirmations, with manual paid/unpaid tracking.

**Architecture:** Two new Convex tables (`paymentMethods`, `paymentMethodDetails`) for payment method CRUD, one new table (`payments`) for booking payment tracking. A new `paymentMethodId` field on venues. Admin UI for method management + venue assignment. Customer-facing display in booking confirmation page and email.

**Tech Stack:** Convex (backend), React 19, Next.js 16, shadcn/ui, React Email, Tailwind v4

---

## File Structure

### Backend (packages/convex/src/)

| File | Responsibility |
|------|---------------|
| `schema.ts` | Add `paymentMethods`, `paymentMethodDetails`, `payments` tables; add `paymentMethodId` to venues |
| `mutations/paymentMethods.ts` | CRUD: create, update, deactivate, reactivate |
| `queries/paymentMethods.ts` | list, get, getForVenue |
| `mutations/payments.ts` | create, void |
| `queries/payments.ts` | getForBooking |
| `mutations/venues.ts` | Add setPaymentMethod, clearPaymentMethod (extend existing file) |

### Admin App (apps/admin/)

| File | Responsibility |
|------|---------------|
| `components/payment-methods-section.tsx` | Payment methods list + add/edit/deactivate UI in org settings |
| `components/payment-method-form.tsx` | Shared form for creating/editing a payment method |
| `components/venue-payment-method-select.tsx` | Payment method dropdown for venue settings |
| `components/booking-payment-status.tsx` | Payment status + mark paid/void UI in booking detail modal |
| `lib/convex-api.ts` | Extend type map with new queries/mutations |

### Customer App (apps/web/)

| File | Responsibility |
|------|---------------|
| `components/payment-info.tsx` | Renders bank account or QR code payment instructions |

### Email (packages/emails/)

| File | Responsibility |
|------|---------------|
| `src/components/payment-info-email.tsx` | Email-compatible payment info component |
| `src/templates/booking-created.tsx` | Extend with conditional PaymentInfo section |

---

## Task 1: Schema — Add payment tables and venue field

**Files:**
- Modify: `packages/convex/src/schema.ts`

- [ ] **Step 1: Add `paymentMethods` table to schema**

Add after the `notifications` table definition:

```typescript
  paymentMethods: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    label: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }).index("by_orgId", ["orgId"]),
```

- [ ] **Step 2: Add `paymentMethodDetails` table to schema**

Add immediately after `paymentMethods`:

```typescript
  paymentMethodDetails: defineTable({
    paymentMethodId: v.id("paymentMethods"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.string()),
    identifierType: v.optional(v.string()),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_paymentMethodId", ["paymentMethodId"]),
```

- [ ] **Step 3: Add `payments` table to schema**

Add immediately after `paymentMethodDetails`:

```typescript
  payments: defineTable({
    bookingId: v.id("bookings"),
    paymentMethodId: v.id("paymentMethods"),
    amount: v.optional(v.number()),
    reference: v.optional(v.string()),
    markedBy: v.id("users"),
    markedAt: v.number(),
    status: v.union(v.literal("paid"), v.literal("voided")),
  }).index("by_bookingId", ["bookingId"]),
```

- [ ] **Step 4: Add `paymentMethodId` field to `venues` table**

In the existing `venues` table definition, add after `minAdvanceBookingMinutes`:

```typescript
    paymentMethodId: v.optional(v.id("paymentMethods")),
```

- [ ] **Step 5: Verify schema compiles**

Run: `pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/schema.ts
git commit -m "feat: add payment methods, details, and payments tables to schema"
```

---

## Task 2: Backend — Payment Methods mutations

**Files:**
- Create: `packages/convex/src/mutations/paymentMethods.ts`

- [ ] **Step 1: Create the mutations file with `create` mutation**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole, assertOrgAccess } from "../lib/auth";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    type: v.union(v.literal("bank_account"), v.literal("qr_code")),
    label: v.string(),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.string()),
    identifierType: v.optional(v.string()),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);
    assertOrgAccess(user, args.orgId);

    const paymentMethodId = await ctx.db.insert("paymentMethods", {
      orgId: args.orgId,
      type: args.type,
      label: args.label,
      status: "active",
    });

    await ctx.db.insert("paymentMethodDetails", {
      paymentMethodId,
      type: args.type,
      holderName: args.holderName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      reference: args.reference,
      method: args.method,
      identifierType: args.identifierType,
      identifierValue: args.identifierValue,
      imageId: args.imageId,
      notes: args.notes,
    });

    return paymentMethodId;
  },
});
```

- [ ] **Step 2: Add `update` mutation**

```typescript
export const update = mutation({
  args: {
    id: v.id("paymentMethods"),
    label: v.optional(v.string()),
    // Bank account fields
    holderName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    reference: v.optional(v.string()),
    // QR code fields
    method: v.optional(v.string()),
    identifierType: v.optional(v.string()),
    identifierValue: v.optional(v.string()),
    imageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    if (args.label) {
      await ctx.db.patch(args.id, { label: args.label });
    }

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) => q.eq("paymentMethodId", args.id))
      .unique();
    if (!details) throw new Error("Payment method details not found");

    const { id: _id, label: _label, ...detailFields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detailFields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(details._id, updates);
    }
  },
});
```

- [ ] **Step 3: Add `deactivate` mutation**

```typescript
export const deactivate = mutation({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    await ctx.db.patch(args.id, { status: "inactive" });

    // Clear paymentMethodId on any venues referencing this method
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", paymentMethod.orgId))
      .take(100);
    for (const venue of venues) {
      if (venue.paymentMethodId?.toString() === args.id.toString()) {
        await ctx.db.patch(venue._id, { paymentMethodId: undefined });
      }
    }
  },
});
```

- [ ] **Step 4: Add `reactivate` mutation**

```typescript
export const reactivate = mutation({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const paymentMethod = await ctx.db.get(args.id);
    if (!paymentMethod) throw new Error("Payment method not found");
    assertOrgAccess(user, paymentMethod.orgId);

    await ctx.db.patch(args.id, { status: "active" });
  },
});
```

- [ ] **Step 5: Verify compilation**

Run: `pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/mutations/paymentMethods.ts
git commit -m "feat: add payment methods CRUD mutations"
```

---

## Task 3: Backend — Payment Methods queries

**Files:**
- Create: `packages/convex/src/queries/paymentMethods.ts`

- [ ] **Step 1: Create the queries file with `list` query**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser, assertOrgAccess } from "../lib/auth";

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertOrgAccess(user, args.orgId);

    const methods = await ctx.db
      .query("paymentMethods")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const results = await Promise.all(
      methods.map(async (method) => {
        const details = await ctx.db
          .query("paymentMethodDetails")
          .withIndex("by_paymentMethodId", (q) => q.eq("paymentMethodId", method._id))
          .unique();
        return { ...method, details };
      }),
    );

    return results;
  },
});
```

- [ ] **Step 2: Add `get` query**

```typescript
export const get = query({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const method = await ctx.db.get(args.id);
    if (!method) return null;
    assertOrgAccess(user, method.orgId);

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) => q.eq("paymentMethodId", args.id))
      .unique();

    return { ...method, details };
  },
});
```

- [ ] **Step 3: Add `getForVenue` query (public — no auth required)**

This query is used by the customer-facing booking confirmation page, so it must not require authentication:

```typescript
export const getForVenue = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue || !venue.paymentMethodId) return null;

    const method = await ctx.db.get(venue.paymentMethodId);
    if (!method || method.status !== "active") return null;

    const details = await ctx.db
      .query("paymentMethodDetails")
      .withIndex("by_paymentMethodId", (q) => q.eq("paymentMethodId", method._id))
      .unique();

    // Resolve QR image URL if present
    let imageUrl: string | null = null;
    if (details?.imageId) {
      imageUrl = await ctx.storage.getUrl(details.imageId as Id<"_storage">);
    }

    return { ...method, details, imageUrl };
  },
});
```

- [ ] **Step 4: Add `listVenuesUsingMethod` query (for deactivate warning)**

```typescript
export const listVenuesUsingMethod = query({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const method = await ctx.db.get(args.id);
    if (!method) return [];
    assertOrgAccess(user, method.orgId);

    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", method.orgId))
      .take(100);

    return venues
      .filter((v) => v.paymentMethodId?.toString() === args.id.toString())
      .map((v) => ({ _id: v._id, name: v.name }));
  },
});
```

- [ ] **Step 5: Verify compilation**

Run: `pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add packages/convex/src/queries/paymentMethods.ts
git commit -m "feat: add payment methods queries"
```

---

## Task 4: Backend — Payments mutations and queries

**Files:**
- Create: `packages/convex/src/mutations/payments.ts`
- Create: `packages/convex/src/queries/payments.ts`

- [ ] **Step 1: Create payments mutations file**

```typescript
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser, assertRole } from "../lib/auth";

export const create = mutation({
  args: {
    bookingId: v.id("bookings"),
    paymentMethodId: v.id("paymentMethods"),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    // Verify no existing non-voided payment
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .take(10);
    const activePayment = existing.find((p) => p.status === "paid");
    if (activePayment) throw new Error("Booking already has an active payment record");

    const paymentId = await ctx.db.insert("payments", {
      bookingId: args.bookingId,
      paymentMethodId: args.paymentMethodId,
      reference: args.reference,
      markedBy: user._id,
      markedAt: Date.now(),
      status: "paid",
    });

    return paymentId;
  },
});

export const voidPayment = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner", "therapist"]);

    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "voided") throw new Error("Payment already voided");

    await ctx.db.patch(args.id, { status: "voided" });
  },
});
```

- [ ] **Step 2: Create payments queries file**

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .take(10);

    // Return the active (non-voided) payment if one exists
    const active = payments.find((p) => p.status === "paid");
    return active ?? null;
  },
});
```

- [ ] **Step 3: Verify compilation**

Run: `pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/convex/src/mutations/payments.ts packages/convex/src/queries/payments.ts
git commit -m "feat: add payments create/void mutations and getForBooking query"
```

---

## Task 5: Backend — Venue payment method mutations

**Files:**
- Modify: `packages/convex/src/mutations/venues.ts`

- [ ] **Step 1: Add `setPaymentMethod` mutation to venues.ts**

Append to the existing file:

```typescript
export const setPaymentMethod = mutation({
  args: {
    id: v.id("venues"),
    paymentMethodId: v.id("paymentMethods"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    // Verify payment method exists and is active
    const method = await ctx.db.get(args.paymentMethodId);
    if (!method) throw new Error("Payment method not found");
    if (method.status !== "active") throw new Error("Payment method is inactive");
    if (method.orgId.toString() !== venue.orgId.toString()) {
      throw new Error("Payment method belongs to a different organization");
    }

    await ctx.db.patch(args.id, { paymentMethodId: args.paymentMethodId });
  },
});

export const clearPaymentMethod = mutation({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertRole(user, ["owner"]);

    const venue = await ctx.db.get(args.id);
    if (!venue) throw new Error("Venue not found");
    assertOrgAccess(user, venue.orgId);

    await ctx.db.patch(args.id, { paymentMethodId: undefined });
  },
});
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/convex/src/mutations/venues.ts
git commit -m "feat: add venue setPaymentMethod and clearPaymentMethod mutations"
```

---

## Task 6: Admin — Update convex-api.ts type map

**Files:**
- Modify: `apps/admin/lib/convex-api.ts`

- [ ] **Step 1: Add payment methods queries to type map**

Add to the `queries` section:

```typescript
    paymentMethods: {
      list: FunctionReference<"query", "public", { orgId: string }, Array<{
        _id: string;
        _creationTime: number;
        orgId: string;
        type: "bank_account" | "qr_code";
        label: string;
        status: "active" | "inactive";
        details: {
          _id: string;
          paymentMethodId: string;
          type: "bank_account" | "qr_code";
          holderName?: string;
          bankName?: string;
          accountNumber?: string;
          reference?: string;
          method?: string;
          identifierType?: string;
          identifierValue?: string;
          imageId?: string;
          notes?: string;
        } | null;
      }>>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        type: "bank_account" | "qr_code";
        label: string;
        status: "active" | "inactive";
        details: {
          _id: string;
          paymentMethodId: string;
          type: "bank_account" | "qr_code";
          holderName?: string;
          bankName?: string;
          accountNumber?: string;
          reference?: string;
          method?: string;
          identifierType?: string;
          identifierValue?: string;
          imageId?: string;
          notes?: string;
        } | null;
      } | null>;
      getForVenue: FunctionReference<"query", "public", { venueId: string }, {
        _id: string;
        type: "bank_account" | "qr_code";
        label: string;
        status: "active" | "inactive";
        details: {
          _id: string;
          paymentMethodId: string;
          type: "bank_account" | "qr_code";
          holderName?: string;
          bankName?: string;
          accountNumber?: string;
          reference?: string;
          method?: string;
          identifierType?: string;
          identifierValue?: string;
          imageId?: string;
          notes?: string;
        } | null;
        imageUrl: string | null;
      } | null>;
      listVenuesUsingMethod: FunctionReference<"query", "public", { id: string }, Array<{
        _id: string;
        name: string;
      }>>;
    };
    payments: {
      getForBooking: FunctionReference<"query", "public", { bookingId: string }, {
        _id: string;
        _creationTime: number;
        bookingId: string;
        paymentMethodId: string;
        reference?: string;
        markedBy: string;
        markedAt: number;
        status: "paid" | "voided";
      } | null>;
    };
```

- [ ] **Step 2: Add payment methods mutations to type map**

Add to the `mutations` section:

```typescript
    paymentMethods: {
      create: FunctionReference<"mutation", "public", {
        orgId: string;
        type: "bank_account" | "qr_code";
        label: string;
        holderName?: string;
        bankName?: string;
        accountNumber?: string;
        reference?: string;
        method?: string;
        identifierType?: string;
        identifierValue?: string;
        imageId?: string;
        notes?: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        label?: string;
        holderName?: string;
        bankName?: string;
        accountNumber?: string;
        reference?: string;
        method?: string;
        identifierType?: string;
        identifierValue?: string;
        imageId?: string;
        notes?: string;
      }, void>;
      deactivate: FunctionReference<"mutation", "public", { id: string }, void>;
      reactivate: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    payments: {
      create: FunctionReference<"mutation", "public", {
        bookingId: string;
        paymentMethodId: string;
        reference?: string;
      }, string>;
      voidPayment: FunctionReference<"mutation", "public", { id: string }, void>;
    };
```

- [ ] **Step 3: Add venue payment method mutations to existing venues section**

Add to the existing `mutations.venues` section:

```typescript
      setPaymentMethod: FunctionReference<"mutation", "public", { id: string; paymentMethodId: string }, void>;
      clearPaymentMethod: FunctionReference<"mutation", "public", { id: string }, void>;
```

- [ ] **Step 4: Add `paymentMethodId` to the `venues.getBySlugFull` return type**

In the existing `queries.venues.getBySlugFull` return type, add:

```typescript
        paymentMethodId?: string;
```

- [ ] **Step 5: Verify compilation**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: No type errors (may have errors from missing components — that's OK at this stage, only check the convex-api types)

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/convex-api.ts
git commit -m "feat: add payment methods types to admin convex-api map"
```

---

## Task 7: Admin — Payment Methods section in Org Settings

**Files:**
- Create: `apps/admin/components/payment-methods-section.tsx`
- Create: `apps/admin/components/payment-method-form.tsx`
- Modify: `apps/admin/components/org-settings-wrapper.tsx` (add section)

- [ ] **Step 1: Create the payment method form component**

Create `apps/admin/components/payment-method-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { Textarea } from "@opencal/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";

interface PaymentMethodFormProps {
  orgId: string;
  initialData?: {
    id: string;
    type: "bank_account" | "qr_code";
    label: string;
    holderName?: string;
    bankName?: string;
    accountNumber?: string;
    reference?: string;
    method?: string;
    identifierType?: string;
    identifierValue?: string;
    imageId?: string;
    notes?: string;
  };
  onDone: () => void;
}

export function PaymentMethodForm({ orgId, initialData, onDone }: PaymentMethodFormProps) {
  const isEditing = !!initialData;
  const [type, setType] = useState<"bank_account" | "qr_code">(initialData?.type ?? "bank_account");
  const [label, setLabel] = useState(initialData?.label ?? "");
  // Bank fields
  const [holderName, setHolderName] = useState(initialData?.holderName ?? "");
  const [bankName, setBankName] = useState(initialData?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber ?? "");
  const [reference, setReference] = useState(initialData?.reference ?? "");
  // QR fields
  const [method, setMethod] = useState(initialData?.method ?? "paynow");
  const [identifierType, setIdentifierType] = useState(initialData?.identifierType ?? "phone");
  const [identifierValue, setIdentifierValue] = useState(initialData?.identifierValue ?? "");
  const [imageId, setImageId] = useState(initialData?.imageId ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const createMutation = useMutation(convexApi.mutations.paymentMethods.create);
  const updateMutation = useMutation(convexApi.mutations.paymentMethods.update);
  const generateUploadUrl = useMutation(convexApi.mutations.generateUploadUrl.generateUploadUrl);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      setImageId(storageId);
      setImagePreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await updateMutation({
          id: initialData.id as any,
          label: label.trim(),
          holderName: type === "bank_account" ? holderName || undefined : undefined,
          bankName: type === "bank_account" ? bankName || undefined : undefined,
          accountNumber: type === "bank_account" ? accountNumber || undefined : undefined,
          reference: type === "bank_account" ? reference || undefined : undefined,
          method: type === "qr_code" ? method || undefined : undefined,
          identifierType: type === "qr_code" ? identifierType || undefined : undefined,
          identifierValue: type === "qr_code" ? identifierValue || undefined : undefined,
          imageId: type === "qr_code" ? imageId || undefined : undefined,
          notes: type === "qr_code" ? notes || undefined : undefined,
        });
        toast.success("Payment method updated");
      } else {
        await createMutation({
          orgId: orgId as any,
          type,
          label: label.trim(),
          holderName: type === "bank_account" ? holderName || undefined : undefined,
          bankName: type === "bank_account" ? bankName || undefined : undefined,
          accountNumber: type === "bank_account" ? accountNumber || undefined : undefined,
          reference: type === "bank_account" ? reference || undefined : undefined,
          method: type === "qr_code" ? method || undefined : undefined,
          identifierType: type === "qr_code" ? identifierType || undefined : undefined,
          identifierValue: type === "qr_code" ? identifierValue || undefined : undefined,
          imageId: type === "qr_code" ? imageId || undefined : undefined,
          notes: type === "qr_code" ? notes || undefined : undefined,
        });
        toast.success("Payment method created");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <div className="space-y-2">
          <Label htmlFor="pm-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "bank_account" | "qr_code")}>
            <SelectTrigger id="pm-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_account">Bank Account</SelectItem>
              <SelectItem value="qr_code">QR Code</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pm-label">Label</Label>
        <Input id="pm-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. OCBC Business or PayNow" />
      </div>

      {type === "bank_account" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="pm-holder">Account Holder Name</Label>
            <Input id="pm-holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-bank">Bank Name</Label>
            <Input id="pm-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-account">Account Number</Label>
            <Input id="pm-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-reference">Reference / Instructions</Label>
            <Textarea id="pm-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Use booking ID as reference" />
          </div>
        </>
      )}

      {type === "qr_code" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="pm-method">Provider</Label>
            <Input id="pm-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="paynow" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-id-type">Identifier Type</Label>
            <Select value={identifierType} onValueChange={setIdentifierType}>
              <SelectTrigger id="pm-id-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="uen">UEN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-id-value">Identifier Value</Label>
            <Input id="pm-id-value" value={identifierValue} onChange={(e) => setIdentifierValue(e.target.value)} placeholder={identifierType === "phone" ? "+65 9123 4567" : "UEN number"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-qr-image">QR Code Image</Label>
            <Input id="pm-qr-image" type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
            {imagePreviewUrl && <img src={imagePreviewUrl} alt="QR preview" className="mt-2 h-32 w-32 rounded border object-contain" />}
            {imageId && !imagePreviewUrl && <p className="text-xs text-muted-foreground">Image uploaded</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-notes">Additional Notes</Label>
            <Textarea id="pm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional instructions" />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the payment methods section component**

Create `apps/admin/components/payment-methods-section.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { PaymentMethodForm } from "./payment-method-form";
import { Button } from "@opencal/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@opencal/ui/components/card";
import { Badge } from "@opencal/ui/components/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@opencal/ui/components/alert-dialog";

interface PaymentMethodsSectionProps {
  orgId: string;
}

export function PaymentMethodsSection({ orgId }: PaymentMethodsSectionProps) {
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const deactivateMutation = useMutation(convexApi.mutations.paymentMethods.deactivate);
  const reactivateMutation = useMutation(convexApi.mutations.paymentMethods.reactivate);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const venuesUsingMethod = useQuery(
    convexApi.queries.paymentMethods.listVenuesUsingMethod,
    deactivatingId ? { id: deactivatingId } : "skip",
  );

  async function handleDeactivate() {
    if (!deactivatingId) return;
    try {
      await deactivateMutation({ id: deactivatingId as any });
      toast.success("Payment method deactivated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate");
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleReactivate(id: string) {
    try {
      await reactivateMutation({ id: id as any });
      toast.success("Payment method reactivated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reactivate");
    }
  }

  if (methods === undefined) return null;

  const editingMethod = editingId
    ? methods.find((m) => m._id === editingId)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment Methods</CardTitle>
        {!showForm && !editingId && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Method
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <PaymentMethodForm orgId={orgId} onDone={() => setShowForm(false)} />
        )}

        {editingMethod && (
          <PaymentMethodForm
            orgId={orgId}
            initialData={{
              id: editingMethod._id,
              type: editingMethod.type,
              label: editingMethod.label,
              holderName: editingMethod.details?.holderName,
              bankName: editingMethod.details?.bankName,
              accountNumber: editingMethod.details?.accountNumber,
              reference: editingMethod.details?.reference,
              method: editingMethod.details?.method,
              identifierType: editingMethod.details?.identifierType,
              identifierValue: editingMethod.details?.identifierValue,
              imageId: editingMethod.details?.imageId,
              notes: editingMethod.details?.notes,
            }}
            onDone={() => setEditingId(null)}
          />
        )}

        {!showForm && !editingId && methods.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No payment methods configured. Add one to display payment instructions to customers.
          </p>
        )}

        {!showForm && !editingId && methods.length > 0 && (
          <div className="space-y-3">
            {methods.map((m) => (
              <div key={m._id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <Badge variant="outline">
                      {m.type === "bank_account" ? "Bank Account" : "QR Code"}
                    </Badge>
                    {m.status === "inactive" && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  {m.type === "bank_account" && m.details?.bankName && (
                    <p className="text-xs text-muted-foreground">{m.details.bankName} — {m.details.accountNumber}</p>
                  )}
                  {m.type === "qr_code" && m.details?.method && (
                    <p className="text-xs text-muted-foreground">{m.details.method} ({m.details.identifierType}: {m.details.identifierValue})</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(m._id)}>
                    Edit
                  </Button>
                  {m.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => setDeactivatingId(m._id)}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleReactivate(m._id)}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Deactivate confirmation dialog */}
      <AlertDialog open={!!deactivatingId} onOpenChange={(open) => { if (!open) setDeactivatingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              {venuesUsingMethod && venuesUsingMethod.length > 0 ? (
                <>
                  This payment method is in use by:{" "}
                  {venuesUsingMethod.map((v) => v.name).join(", ")}.
                  Deactivating will remove it from those venues.
                </>
              ) : (
                "This payment method will be hidden from venue selection. Historical payment records will be preserved."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

- [ ] **Step 3: Add PaymentMethodsSection to org settings wrapper**

In `apps/admin/components/org-settings-wrapper.tsx`, import and render `<PaymentMethodsSection orgId={org._id} />` below the existing `<OrgSettingsForm>` component.

```typescript
import { PaymentMethodsSection } from "./payment-methods-section";

// Inside the return, after <OrgSettingsForm orgId={org._id} />:
<PaymentMethodsSection orgId={org._id} />
```

- [ ] **Step 4: Verify the admin app compiles**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/payment-methods-section.tsx apps/admin/components/payment-method-form.tsx apps/admin/components/org-settings-wrapper.tsx
git commit -m "feat: add payment methods management UI in org settings"
```

---

## Task 8: Admin — Venue Payment Method Selector

**Files:**
- Create: `apps/admin/components/venue-payment-method-select.tsx`
- Modify: `apps/admin/components/venue-settings-page.tsx`

- [ ] **Step 1: Create the venue payment method select component**

Create `apps/admin/components/venue-payment-method-select.tsx`:

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Label } from "@opencal/ui/components/label";
import { Badge } from "@opencal/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";
import Link from "next/link";

interface VenuePaymentMethodSelectProps {
  venueId: string;
  orgId: string;
  orgSlug: string;
  currentPaymentMethodId?: string;
}

export function VenuePaymentMethodSelect({
  venueId,
  orgId,
  orgSlug,
  currentPaymentMethodId,
}: VenuePaymentMethodSelectProps) {
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const setPaymentMethod = useMutation(convexApi.mutations.venues.setPaymentMethod);
  const clearPaymentMethod = useMutation(convexApi.mutations.venues.clearPaymentMethod);

  const activeMethods = methods?.filter((m) => m.status === "active") ?? [];
  const currentMethod = methods?.find((m) => m._id === currentPaymentMethodId);
  const isCurrentInactive = currentMethod?.status === "inactive";

  async function handleChange(value: string) {
    try {
      if (value === "none") {
        await clearPaymentMethod({ id: venueId as any });
        toast.success("Payment method removed");
      } else {
        await setPaymentMethod({ id: venueId as any, paymentMethodId: value as any });
        toast.success("Payment method updated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  if (methods === undefined) return null;

  if (methods.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <p className="text-sm text-muted-foreground">
          No payment methods configured.{" "}
          <Link href={`/${orgSlug}/settings`} className="underline">
            Add one in org settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="venue-pm-select">Payment Method</Label>
      {isCurrentInactive && (
        <Badge variant="destructive" className="ml-2">
          Current method inactive — please select a new one
        </Badge>
      )}
      <Select value={currentPaymentMethodId ?? "none"} onValueChange={handleChange}>
        <SelectTrigger id="venue-pm-select">
          <SelectValue placeholder="Select payment method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {activeMethods.map((m) => (
            <SelectItem key={m._id} value={m._id}>
              {m.label} ({m.type === "bank_account" ? "Bank" : "QR"})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into venue settings page**

In `apps/admin/components/venue-settings-page.tsx`, import and render `<VenuePaymentMethodSelect>` inside the settings card, after the existing fields (e.g. after the min advance booking section):

```typescript
import { VenuePaymentMethodSelect } from "./venue-payment-method-select";

// Inside the return, within the Card's CardContent:
<VenuePaymentMethodSelect
  venueId={venue._id}
  orgId={org._id}
  orgSlug={orgSlug}
  currentPaymentMethodId={venue.paymentMethodId}
/>
```

- [ ] **Step 3: Verify compilation**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/venue-payment-method-select.tsx apps/admin/components/venue-settings-page.tsx
git commit -m "feat: add payment method selector to venue settings"
```

---

## Task 9: Admin — Booking Payment Status in Detail Modal

**Files:**
- Create: `apps/admin/components/booking-payment-status.tsx`
- Modify: `apps/admin/components/booking-detail-modal.tsx`

- [ ] **Step 1: Create the booking payment status component**

Create `apps/admin/components/booking-payment-status.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Badge } from "@opencal/ui/components/badge";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@opencal/ui/components/alert-dialog";

interface BookingPaymentStatusProps {
  bookingId: string;
  venueId: string;
  orgId: string;
}

export function BookingPaymentStatus({ bookingId, venueId, orgId }: BookingPaymentStatusProps) {
  const payment = useQuery(convexApi.queries.payments.getForBooking, { bookingId: bookingId as any });
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const markedByUser = useQuery(
    convexApi.queries.users.getPublic,
    payment ? { id: payment.markedBy } : "skip",
  );

  const createPayment = useMutation(convexApi.mutations.payments.create);
  const voidPayment = useMutation(convexApi.mutations.payments.voidPayment);

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMethods = methods?.filter((m) => m.status === "active") ?? [];

  // Auto-select if only one method
  if (activeMethods.length === 1 && !selectedMethodId) {
    setSelectedMethodId(activeMethods[0]._id);
  }

  async function handleMarkPaid() {
    if (!selectedMethodId) {
      toast.error("Please select a payment method");
      return;
    }
    setIsSubmitting(true);
    try {
      await createPayment({
        bookingId: bookingId as any,
        paymentMethodId: selectedMethodId as any,
        reference: paymentReference || undefined,
      });
      toast.success("Booking marked as paid");
      setShowMarkPaid(false);
      setPaymentReference("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as paid");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoid() {
    if (!payment) return;
    setIsSubmitting(true);
    try {
      await voidPayment({ id: payment._id as any });
      toast.success("Payment voided");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (payment === undefined || methods === undefined) return null;

  // Payment exists — show status
  if (payment) {
    const method = methods.find((m) => m._id === payment.paymentMethodId);
    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Payment</span>
            <Badge variant="default">Paid</Badge>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={isSubmitting}>
                Void
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void this payment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the payment as voided. The booking will show as unpaid again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleVoid}>Void Payment</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {method && <p>Method: {method.label}</p>}
          {payment.reference && <p>Reference: {payment.reference}</p>}
          <p>Marked by {markedByUser?.name ?? "..."} on {new Date(payment.markedAt).toLocaleDateString()}</p>
        </div>
      </div>
    );
  }

  // No payment — show mark as paid
  if (!showMarkPaid) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Payment</span>
          <Badge variant="outline">Unpaid</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowMarkPaid(true)}>
          Mark as Paid
        </Button>
      </div>
    );
  }

  // Mark as paid form
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Mark as Paid</p>
      {activeMethods.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor="pay-method" className="text-xs">Payment Method</Label>
          <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
            <SelectTrigger id="pay-method">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {activeMethods.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="pay-ref" className="text-xs">Reference (optional)</Label>
        <Input id="pay-ref" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Transaction ID or transfer ref" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleMarkPaid} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Confirm"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowMarkPaid(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into booking detail modal**

In `apps/admin/components/booking-detail-modal.tsx`, import and add `<BookingPaymentStatus>` after the customer info section:

```typescript
import { BookingPaymentStatus } from "./booking-payment-status";

// Inside the dialog content, after the customer info div:
{!readOnly && booking.status !== "cancelled" && (
  <BookingPaymentStatus
    bookingId={bookingId}
    venueId={booking.venueId}
    orgId={/* need org context */}
  />
)}
```

The booking detail modal needs access to the org ID. Either:
- Pass it as a new prop `orgId` to `BookingDetailModal`
- Or resolve it from the venue query that already exists in the component

Use the venue approach — the modal already queries the venue. Get orgId from `venue.orgId`:

```typescript
// After the existing venue query resolution:
const resolvedOrgId = venue?.orgId ?? null;

// Then in the JSX:
{!readOnly && booking.status !== "cancelled" && resolvedOrgId && (
  <BookingPaymentStatus
    bookingId={bookingId}
    venueId={booking.venueId}
    orgId={resolvedOrgId}
  />
)}
```

- [ ] **Step 3: Verify compilation**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/booking-payment-status.tsx apps/admin/components/booking-detail-modal.tsx
git commit -m "feat: add payment status and mark-as-paid UI in booking detail modal"
```

---

## Task 10: Customer App — Payment Info Display

**Files:**
- Create: `apps/web/components/payment-info.tsx`
- Modify: `apps/web/components/booking-confirmation.tsx`

- [ ] **Step 1: Create the payment info component**

Create `apps/web/components/payment-info.tsx`:

```typescript
"use client";

import { Card } from "@opencal/ui/components/card";

interface PaymentInfoProps {
  type: "bank_account" | "qr_code";
  label: string;
  details: {
    holderName?: string;
    bankName?: string;
    accountNumber?: string;
    reference?: string;
    method?: string;
    identifierType?: string;
    identifierValue?: string;
    notes?: string;
  } | null;
  imageUrl: string | null;
}

export function PaymentInfo({ type, label, details, imageUrl }: PaymentInfoProps) {
  if (!details) return null;

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-medium">Payment Instructions</h3>

      {type === "bank_account" && (
        <div className="space-y-2 text-sm">
          {details.bankName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank</span>
              <span>{details.bankName}</span>
            </div>
          )}
          {details.holderName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Holder</span>
              <span>{details.holderName}</span>
            </div>
          )}
          {details.accountNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-mono">{details.accountNumber}</span>
            </div>
          )}
          {details.reference && (
            <div className="pt-2 text-xs text-muted-foreground">
              {details.reference}
            </div>
          )}
        </div>
      )}

      {type === "qr_code" && (
        <div className="space-y-3 text-sm">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={`${label} QR code`}
              className="mx-auto h-48 w-48 rounded border object-contain"
            />
          )}
          {details.method && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="capitalize">{details.method}</span>
            </div>
          )}
          {details.identifierType && details.identifierValue && (
            <div className="flex justify-between">
              <span className="text-muted-foreground capitalize">{details.identifierType}</span>
              <span className="font-mono">{details.identifierValue}</span>
            </div>
          )}
          {details.notes && (
            <div className="pt-2 text-xs text-muted-foreground">
              {details.notes}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Integrate into booking confirmation page**

In `apps/web/components/booking-confirmation.tsx`:

1. Add imports and query:

```typescript
import { PaymentInfo } from "./payment-info";

// Add to the convexApi type cast:
// queries.paymentMethods: { getForVenue: FunctionReference<"query"> }
// queries.payments: { getForBooking: FunctionReference<"query"> }

// Add queries inside the component:
const paymentMethod = useQuery(
  convexApi.queries.paymentMethods.getForVenue,
  venue ? { venueId: venue._id } : "skip",
);
const payment = useQuery(
  convexApi.queries.payments.getForBooking,
  booking ? { bookingId: booking._id } : "skip",
);
```

2. Add PaymentInfo rendering (after the booking detail card, before the cancel button):

```typescript
{/* Payment info — only if method configured and no active payment */}
{paymentMethod && !payment && booking.status !== "cancelled" && (
  <PaymentInfo
    type={paymentMethod.type}
    label={paymentMethod.label}
    details={paymentMethod.details}
    imageUrl={paymentMethod.imageUrl}
  />
)}
```

- [ ] **Step 3: Add the query types to the web app's convex API cast**

In the existing `convexApi` type cast within `booking-confirmation.tsx`, add:

```typescript
paymentMethods: { getForVenue: FunctionReference<"query"> };
payments: { getForBooking: FunctionReference<"query"> };
```

- [ ] **Step 4: Verify compilation**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/payment-info.tsx apps/web/components/booking-confirmation.tsx
git commit -m "feat: display payment info on customer booking confirmation page"
```

---

## Task 11: Email — Payment Info in Booking Created Email

**Files:**
- Create: `packages/emails/src/components/payment-info-email.tsx`
- Modify: `packages/emails/src/templates/booking-created.tsx`
- Modify: `packages/convex/src/actions/sendBookingCreatedEmail.ts`

- [ ] **Step 1: Create the email payment info component**

Create `packages/emails/src/components/payment-info-email.tsx`:

```typescript
import { Section, Text, Img, Hr } from "@react-email/components";

interface PaymentInfoEmailProps {
  type: "bank_account" | "qr_code";
  label: string;
  // Bank account fields
  holderName?: string;
  bankName?: string;
  accountNumber?: string;
  reference?: string;
  // QR code fields
  method?: string;
  identifierType?: string;
  identifierValue?: string;
  imageUrl?: string;
  notes?: string;
}

export function PaymentInfoEmail(props: PaymentInfoEmailProps) {
  const { type, label } = props;

  return (
    <Section style={container}>
      <Hr style={divider} />
      <Text style={heading}>Payment Instructions</Text>

      {type === "bank_account" && (
        <>
          {props.bankName && (
            <Text style={row}>
              <span style={rowLabel}>Bank:</span> {props.bankName}
            </Text>
          )}
          {props.holderName && (
            <Text style={row}>
              <span style={rowLabel}>Account Holder:</span> {props.holderName}
            </Text>
          )}
          {props.accountNumber && (
            <Text style={row}>
              <span style={rowLabel}>Account Number:</span>{" "}
              <span style={mono}>{props.accountNumber}</span>
            </Text>
          )}
          {props.reference && (
            <Text style={note}>{props.reference}</Text>
          )}
        </>
      )}

      {type === "qr_code" && (
        <>
          {props.imageUrl && (
            <Img
              src={props.imageUrl}
              alt={`${label} QR code`}
              width="200"
              height="200"
              style={qrImage}
            />
          )}
          {props.method && (
            <Text style={row}>
              <span style={rowLabel}>Method:</span> {props.method}
            </Text>
          )}
          {props.identifierType && props.identifierValue && (
            <Text style={row}>
              <span style={rowLabel}>{props.identifierType === "phone" ? "Phone" : "UEN"}:</span>{" "}
              <span style={mono}>{props.identifierValue}</span>
            </Text>
          )}
          {props.notes && (
            <Text style={note}>{props.notes}</Text>
          )}
        </>
      )}
    </Section>
  );
}

export function paymentInfoPlainText(props: PaymentInfoEmailProps): string {
  const lines = ["", "Payment Instructions:", `Method: ${props.label}`];

  if (props.type === "bank_account") {
    if (props.bankName) lines.push(`Bank: ${props.bankName}`);
    if (props.holderName) lines.push(`Account Holder: ${props.holderName}`);
    if (props.accountNumber) lines.push(`Account Number: ${props.accountNumber}`);
    if (props.reference) lines.push(`Note: ${props.reference}`);
  } else {
    if (props.method) lines.push(`Provider: ${props.method}`);
    if (props.identifierType && props.identifierValue) {
      lines.push(`${props.identifierType === "phone" ? "Phone" : "UEN"}: ${props.identifierValue}`);
    }
    if (props.notes) lines.push(`Note: ${props.notes}`);
  }

  return lines.join("\n");
}

const container: React.CSSProperties = {
  marginTop: "24px",
};

const divider: React.CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "0 0 16px",
};

const heading: React.CSSProperties = {
  color: "#18181b",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 12px",
};

const row: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: "13px",
  margin: "0 0 6px",
  lineHeight: "20px",
};

const rowLabel: React.CSSProperties = {
  color: "#71717a",
};

const mono: React.CSSProperties = {
  fontFamily: "monospace",
};

const note: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  margin: "8px 0 0",
  fontStyle: "italic",
};

const qrImage: React.CSSProperties = {
  margin: "0 auto 12px",
  display: "block",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};
```

- [ ] **Step 2: Extend BookingCreated template props and rendering**

In `packages/emails/src/templates/booking-created.tsx`:

1. Add import:

```typescript
import { PaymentInfoEmail, paymentInfoPlainText } from "../components/payment-info-email";
```

2. Extend the `BookingCreatedProps` interface:

```typescript
  // Payment info (optional — only passed when venue has a method configured)
  paymentInfo?: {
    type: "bank_account" | "qr_code";
    label: string;
    holderName?: string;
    bankName?: string;
    accountNumber?: string;
    reference?: string;
    method?: string;
    identifierType?: string;
    identifierValue?: string;
    imageUrl?: string;
    notes?: string;
  };
```

3. Add rendering after the buttons section, before the cancel text:

```typescript
      {props.paymentInfo && (
        <PaymentInfoEmail {...props.paymentInfo} />
      )}
```

4. Update `bookingCreatedPlainText` to include payment info:

```typescript
  if (props.paymentInfo) {
    lines.push(paymentInfoPlainText(props.paymentInfo));
  }
```

- [ ] **Step 3: Update sendBookingCreatedEmail action to pass payment info**

In `packages/convex/src/actions/sendBookingCreatedEmail.ts`, after resolving the venue, fetch the payment method data and pass it to the email template:

```typescript
// After fetching the venue, resolve payment method if configured
let paymentInfo: BookingCreatedProps["paymentInfo"] = undefined;
if (venue.paymentMethodId) {
  const method = await ctx.runQuery(api.queries.paymentMethods.getForVenue, {
    venueId: venue._id,
  });
  if (method && method.details) {
    paymentInfo = {
      type: method.type,
      label: method.label,
      holderName: method.details.holderName,
      bankName: method.details.bankName,
      accountNumber: method.details.accountNumber,
      reference: method.details.reference,
      method: method.details.method,
      identifierType: method.details.identifierType,
      identifierValue: method.details.identifierValue,
      imageUrl: method.imageUrl ?? undefined,
      notes: method.details.notes,
    };
  }
}

// Pass paymentInfo to the template props:
// { ...existingProps, paymentInfo }
```

- [ ] **Step 4: Verify compilation**

Run: `pnpm --filter @opencal/emails exec tsc --noEmit && pnpm --filter @opencal/convex exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/emails/src/components/payment-info-email.tsx packages/emails/src/templates/booking-created.tsx packages/convex/src/actions/sendBookingCreatedEmail.ts
git commit -m "feat: add payment info section to booking confirmation email"
```

---

## Task 12: Final Integration — Verify End-to-End

**Files:**
- No new files

- [ ] **Step 1: Run full type check across the monorepo**

Run: `pnpm tsc --build`
Expected: No type errors

- [ ] **Step 2: Verify Convex schema pushes without error**

Ask the user to confirm their Convex dev server accepts the schema changes (since we don't start dev servers).

- [ ] **Step 3: Smoke test checklist (manual)**

Verify the following flows work:
1. Org settings → Add bank account payment method → appears in list
2. Org settings → Add QR code payment method with image upload → appears in list
3. Org settings → Deactivate a method that's assigned to a venue → confirm dialog shows venue name → deactivate clears venue assignment
4. Venue settings → Select a payment method from dropdown → saves
5. Booking detail modal → shows "Unpaid" badge → mark as paid with reference → shows "Paid" badge with details → void → back to unpaid
6. Customer booking confirmation page → shows payment instructions when unpaid → hides after marked paid
7. Booking created email → includes payment instructions section

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address integration issues from payment methods feature"
```

---

## Summary

| Task | Scope | Dependencies |
|------|-------|--------------|
| 1 | Schema | None |
| 2 | Payment Methods mutations | Task 1 |
| 3 | Payment Methods queries | Task 1 |
| 4 | Payments mutations + queries | Task 1 |
| 5 | Venue payment method mutations | Task 1 |
| 6 | Admin convex-api types | Tasks 2-5 |
| 7 | Admin org settings UI | Task 6 |
| 8 | Admin venue settings UI | Task 6 |
| 9 | Admin booking modal UI | Task 6 |
| 10 | Customer confirmation page | Tasks 3, 4 |
| 11 | Email template | Tasks 3, 4 |
| 12 | Final integration check | All |

Tasks 2-5 can be done in parallel after Task 1. Tasks 7-9 can be done in parallel after Task 6. Tasks 10-11 can be done in parallel with Tasks 7-9.
