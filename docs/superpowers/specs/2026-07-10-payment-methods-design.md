# Payment Methods Design

Date: 2026-07-10

## Overview

Support informational payment methods at the organisation level, configurable per venue. Payment methods display in booking confirmation emails and the booking confirmation page. Therapists and admins can manually mark bookings as paid.

This is not payment processing — there is no automatic reconciliation. It displays payment instructions to customers and tracks payment status manually.

## Data Model

### New table: `paymentMethods`

The parent/header record for a payment method.

| Field | Type | Notes |
|-------|------|-------|
| `orgId` | `id("organizations")` | |
| `type` | `"bank_account" \| "qr_code"` | Discriminator, extensible |
| `label` | `string` | Display name, e.g. "OCBC Business" or "PayNow" |
| `status` | `"active" \| "inactive"` | Inactive methods hidden from dropdowns, preserved for historical records |

Indexes: `by_orgId`

### New table: `paymentMethodDetails`

Polymorphic details table. One row per payment method (1:1 with parent).

| Field | Type | Notes |
|-------|------|-------|
| `paymentMethodId` | `id("paymentMethods")` | Foreign key to parent |
| `type` | `"bank_account" \| "qr_code"` | Discriminator (denormalised for query convenience) |
| `holderName` | optional `string` | Bank account: account holder name |
| `bankName` | optional `string` | Bank account: bank name |
| `accountNumber` | optional `string` | Bank account: account number |
| `reference` | optional `string` | Bank account: reference instructions (e.g. "use booking ID") |
| `method` | optional `string` | QR: provider, e.g. "paynow" |
| `identifierType` | optional `string` | QR: "phone" or "uen" |
| `identifierValue` | optional `string` | QR: the actual phone number or UEN |
| `imageId` | optional `string` | QR: Convex file storage ID for uploaded QR image |
| `notes` | optional `string` | QR: additional instructions |

Indexes: `by_paymentMethodId`

### Venues table additions

| Field | Type | Notes |
|-------|------|-------|
| `paymentMethodId` | optional `id("paymentMethods")` | Single selection for now; swap to array for multi-method later |

### New table: `payments`

Records manual payment confirmations against bookings. Separates the payment domain from the booking domain.

| Field | Type | Notes |
|-------|------|-------|
| `bookingId` | `id("bookings")` | FK to booking (1:1 for now, 1:many ready) |
| `paymentMethodId` | `id("paymentMethods")` | Which payment method was used |
| `amount` | optional `number` | Optional — for future use (partial payments) |
| `reference` | optional `string` | Transaction/transfer reference for reconciliation |
| `markedBy` | `id("users")` | Who recorded the payment |
| `markedAt` | `number` | Timestamp when recorded |
| `status` | `"paid" \| "voided"` | Voided = undo without hard delete |

Indexes: `by_bookingId`

## API Layer

### Payment Method CRUD (owner-only)

| Mutation/Query | Purpose |
|----------------|---------|
| `paymentMethods.create` | Creates parent + details row atomically |
| `paymentMethods.update` | Updates label/status on parent, type-specific fields on details |
| `paymentMethods.deactivate` | Sets status to "inactive". Preserved for historical payment records. |
| `paymentMethods.list` | Returns all active methods for an org (joins details) |
| `paymentMethods.get` | Returns single method + details |

### Venue Payment Config (owner-only)

| Mutation | Purpose |
|----------|---------|
| `venues.setPaymentMethod` | Sets `paymentMethodId` on a venue |
| `venues.clearPaymentMethod` | Removes payment method from a venue |

### Payments (owner + therapist)

| Mutation/Query | Purpose |
|----------|---------|
| `payments.create` | Creates a payment record for a booking (paymentMethodId, optional reference) |
| `payments.void` | Sets status to "voided" (undo without hard delete) |
| `payments.getForBooking` | Returns payment record for a booking (if exists) |

### Queries

| Query | Purpose |
|-------|---------|
| `paymentMethods.getForVenue` | Given venueId, resolves the venue's payment method + details |

## UI

### Admin — Org Settings: Payment Methods

Location: `[orgSlug]/(dashboard)/settings/` — new "Payment Methods" tab or section.

- **List view:** Table showing label, type badge, status, and "Used by" column (venue count or names with links).
- **Add form:** Type selector (bank account or QR code) → renders conditional fields based on type. QR image upload via Convex file storage.
- **Edit form:** Same as add, pre-populated.
- **Deactivate:** Confirmation dialog. If referenced by venues, warn: "This payment method is in use by [Venue X]. Deactivating will remove it from those venues." → sets status to "inactive", clears `paymentMethodId` on referencing venues.
- Inactive methods preserved in list with "Inactive" badge for historical reference. Can be reactivated.

### Admin — Venue Settings: Payment Method Selector

Location: `[orgSlug]/venues/[venueSlug]/settings/`

- Dropdown/select of active org payment methods (shows label + type).
- "None" option to clear.
- If current method is inactive: warning badge prompting selection of a new one.
- Empty state if org has no payment methods: "No payment methods configured" with link to org settings.

### Admin — Booking Detail Modal: Paid Toggle

Location: Within existing booking detail modal on the venue bookings page.

- Shows current payment status badge (Paid / Unpaid) based on whether a non-voided payment record exists.
- "Mark as Paid" button → confirmation dialog ("Are you sure you want to mark this booking as paid?") with payment method selector (auto-selected if venue has only one configured method, or if org has only one active method), optional text input for payment reference (e.g. transaction ID, transfer ref) → calls `payments.create`.
- If already paid: shows who recorded it and when, which payment method was used, plus payment reference if provided, with "Void Payment" button (also with confirmation) → calls `payments.void`.
- Accessible to both owners and therapists.

### Customer — Booking Confirmation Page

Location: After successful booking + customer booking view page.

- If venue has a payment method configured AND booking has no non-voided payment record:
  - **Bank account:** Details card with holder name, bank name, account number, reference instructions.
  - **QR code:** Uploaded QR image rendered at readable size, method name (e.g. "PayNow"), identifier type + value, notes.
- If a non-voided payment exists or no payment method configured: payment section hidden.

### Emails — BookingCreated Template

- New conditional `PaymentInfo` component added to the `BookingCreated` email template.
- Same display logic as the confirmation page (bank details card or QR image).
- QR image served via public Convex file storage URL (static image in email).
- Only rendered when booking has no non-voided payment record and venue has a payment method configured.

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Venue has no payment method set | No payment info shown anywhere |
| Deactivate payment method while venue references it | Warn admin, then clear `paymentMethodId` on referencing venues upon confirmation |
| Org has no payment methods | Venue settings dropdown shows empty state with link to org settings |
| Booking already paid, customer revisits confirmation | Payment section hidden (non-voided payment exists) |
| Booking cancelled after being marked paid | Payment record preserved (informational only) |
| QR image not uploaded (only identifier stored) | Render text-only: method + identifier type + value |
| Inactive payment method referenced by venue | Venue's `paymentMethodId` cleared on deactivation. Payment info stops rendering for customers. Historical payment records still reference the method. |
| Therapist vs Owner permissions for paid toggle | Both can mark paid/unpaid |

## Future Considerations

- **Multiple methods per venue:** Swap `paymentMethodId` (single ID) to an array.
- **PSP integration:** Add new `type` variants (e.g. `"stripe"`, `"hitpay"`) with their own fields in the details table. The `type` discriminator and normalised details table support this without structural changes.
- **Partial payments / refunds:** The `payments` table supports multiple records per booking. Add `amount` field usage and a `"refunded"` status.
- **Validation:** Add format validation for `identifierValue` based on `identifierType` (phone number format, UEN format).
- **Key-value style details:** If the details table grows unwieldy, can migrate to a key-value structure behind a feature flag.
