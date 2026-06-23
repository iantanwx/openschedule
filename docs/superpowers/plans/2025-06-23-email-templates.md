# Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain-text transactional emails with branded HTML templates using React Email, add .ics attachments and Google Calendar links.

**Architecture:** New `packages/emails/` workspace package with React Email components and templates. Convex actions import templates, render to HTML, and pass to an upgraded `sendEmail` helper that supports html + attachments via the Resend API.

**Tech Stack:** React Email (@react-email/components, @react-email/render), Resend HTTP API, RFC 5545 .ics generation, Google Static Maps API, Google Calendar URL builder.

---

## Task 1: Create `packages/emails/` package scaffold

- [ ] Create `packages/emails/package.json`
- [ ] Create `packages/emails/tsconfig.json`
- [ ] Create `packages/emails/src/index.ts`
- [ ] Run `pnpm install` from workspace root
- [ ] Run typecheck
- [ ] Commit

### Steps

**1.1 Create `packages/emails/package.json`:**

```json
{
  "name": "@openschedule/emails",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts",
    "./templates/*": "./src/templates/*.tsx",
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@react-email/components": "^0.0.36",
    "@react-email/render": "^1.0.5",
    "react": "^19.1.0"
  },
  "devDependencies": {
    "@openschedule/typescript-config": "workspace:*",
    "@types/react": "^19.1.0",
    "typescript": "^5"
  }
}
```

**1.2 Create `packages/emails/tsconfig.json`:**

```json
{
  "extends": "@openschedule/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ESNext"
  },
  "include": ["src"]
}
```

**1.3 Create `packages/emails/src/index.ts`:**

```ts
// Templates
export { BookingCreated, bookingCreatedPlainText } from "./templates/booking-created";
export { BookingCancelled, bookingCancelledPlainText } from "./templates/booking-cancelled";
export { BookingRescheduled, bookingRescheduledPlainText } from "./templates/booking-rescheduled";
export { Invitation, invitationPlainText } from "./templates/invitation";

// Components
export { EmailLayout } from "./components/email-layout";
export { DetailsCard } from "./components/details-card";
export { StaticMap } from "./components/static-map";
export { EmailButton } from "./components/email-button";
export { StatusBadge } from "./components/status-badge";

// Lib
export { generateIcs } from "./lib/ics";
export type { IcsEventData } from "./lib/ics";
export { buildGoogleCalendarUrl } from "./lib/calendar-url";
export type { CalendarUrlData } from "./lib/calendar-url";
```

> NOTE: This file will have import errors until all source files are created. That's fine — we'll typecheck after Task 4.

**1.4 Run install and typecheck:**

```bash
cd /Users/xen.n-ian/projects/openschedule && pnpm install
```

Expected: lockfile updates, `packages/emails/node_modules` populated.

Typecheck will fail until all exported files exist. For now, just verify the package is recognized:

```bash
pnpm --filter @openschedule/emails exec -- echo "package found"
```

Expected output: `package found`

**1.5 Commit:**

```bash
git add packages/emails/package.json packages/emails/tsconfig.json packages/emails/src/index.ts pnpm-lock.yaml
git commit -m "feat(emails): scaffold packages/emails package"
```

---

## Task 2: Shared email components

- [ ] Create `packages/emails/src/components/email-layout.tsx`
- [ ] Create `packages/emails/src/components/details-card.tsx`
- [ ] Create `packages/emails/src/components/static-map.tsx`
- [ ] Create `packages/emails/src/components/email-button.tsx`
- [ ] Create `packages/emails/src/components/status-badge.tsx`
- [ ] Run typecheck
- [ ] Commit

### Steps

**2.1 Create `packages/emails/src/components/email-layout.tsx`:**

```tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  orgName: string;
  children: ReactNode;
}

export function EmailLayout({ orgName, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerText}>{orgName}</Text>
          </Section>

          {/* Body */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={footerHr} />
            <Text style={footerText}>
              Powered by OpenSchedule
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: "0",
  padding: "40px 0",
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
};

const header: React.CSSProperties = {
  backgroundColor: "#18181b",
  borderRadius: "8px 8px 0 0",
  padding: "20px 24px",
};

const headerText: React.CSSProperties = {
  color: "#fafafa",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0",
};

const content: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderTop: "none",
  borderRadius: "0 0 8px 8px",
  padding: "32px 24px",
};

const footer: React.CSSProperties = {
  padding: "16px 24px 0",
};

const footerHr: React.CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "0 0 16px",
};

const footerText: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0",
};
```

**2.2 Create `packages/emails/src/components/details-card.tsx`:**

```tsx
import { Section, Row, Column, Text } from "@react-email/components";

interface DetailsCardProps {
  items: Array<{ label: string; value: string }>;
}

export function DetailsCard({ items }: DetailsCardProps) {
  return (
    <Section style={card}>
      {items.map((item) => (
        <Row key={item.label} style={row}>
          <Column style={labelCol}>
            <Text style={label}>{item.label}</Text>
          </Column>
          <Column style={valueCol}>
            <Text style={value}>{item.value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

const card: React.CSSProperties = {
  backgroundColor: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  padding: "16px",
  margin: "24px 0",
};

const row: React.CSSProperties = {
  marginBottom: "8px",
};

const labelCol: React.CSSProperties = {
  width: "120px",
  verticalAlign: "top",
};

const valueCol: React.CSSProperties = {
  verticalAlign: "top",
};

const label: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  margin: "0 0 4px",
};

const value: React.CSSProperties = {
  color: "#18181b",
  fontSize: "13px",
  fontWeight: "500",
  margin: "0 0 4px",
};
```

**2.3 Create `packages/emails/src/components/static-map.tsx`:**

```tsx
import { Section, Img, Text, Link } from "@react-email/components";

interface StaticMapProps {
  coordinates: { lat: number; lng: number };
  address: string;
  placeId?: string;
  apiKey: string;
}

export function StaticMap({
  coordinates,
  address,
  placeId,
  apiKey,
}: StaticMapProps) {
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=15&size=480x140&scale=2&markers=color:red%7C${coordinates.lat},${coordinates.lng}&key=${apiKey}`;

  const directionsUrl = placeId
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&destination_place_id=${placeId}`
    : `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;

  return (
    <Section style={mapSection}>
      <Img
        src={mapUrl}
        alt={`Map showing ${address}`}
        width="480"
        height="140"
        style={mapImage}
      />
      <Text style={addressText}>{address}</Text>
      <Link href={directionsUrl} style={directionsLink}>
        Get directions →
      </Link>
    </Section>
  );
}

const mapSection: React.CSSProperties = {
  margin: "24px 0",
};

const mapImage: React.CSSProperties = {
  width: "100%",
  height: "auto",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};

const addressText: React.CSSProperties = {
  color: "#18181b",
  fontSize: "13px",
  margin: "8px 0 4px",
};

const directionsLink: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  textDecoration: "none",
};
```

**2.4 Create `packages/emails/src/components/email-button.tsx`:**

```tsx
import { Button } from "@react-email/components";
import type { ReactNode } from "react";

interface EmailButtonProps {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function EmailButton({
  href,
  variant = "primary",
  children,
}: EmailButtonProps) {
  const style = variant === "primary" ? primaryStyle : secondaryStyle;

  return (
    <Button href={href} style={style}>
      {children}
    </Button>
  );
}

const primaryStyle: React.CSSProperties = {
  backgroundColor: "#18181b",
  color: "#fafafa",
  fontSize: "14px",
  fontWeight: "500",
  borderRadius: "6px",
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
};

const secondaryStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#18181b",
  fontSize: "14px",
  fontWeight: "500",
  borderRadius: "6px",
  border: "1px solid #e4e4e7",
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
};
```

**2.5 Create `packages/emails/src/components/status-badge.tsx`:**

```tsx
import { Text } from "@react-email/components";

interface StatusBadgeProps {
  status: "confirmed" | "cancelled" | "rescheduled";
}

const statusConfig = {
  confirmed: { bg: "#dcfce7", color: "#166534", label: "Confirmed" },
  cancelled: { bg: "#fef2f2", color: "#991b1b", label: "Cancelled" },
  rescheduled: { bg: "#eff6ff", color: "#1e40af", label: "Rescheduled" },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Text
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: "12px",
        fontWeight: "600",
        padding: "4px 12px",
        borderRadius: "9999px",
        display: "inline-block",
        margin: "0 0 16px",
      }}
    >
      {config.label}
    </Text>
  );
}
```

**2.6 Typecheck:**

```bash
pnpm --filter @openschedule/emails typecheck
```

Expected: Success (or only warnings — no errors).

**2.7 Commit:**

```bash
git add packages/emails/src/components/
git commit -m "feat(emails): add shared email components"
```

---

## Task 3: Calendar utilities

- [ ] Create `packages/emails/src/lib/ics.ts`
- [ ] Create `packages/emails/src/lib/calendar-url.ts`
- [ ] Verify exports from `src/index.ts`
- [ ] Run typecheck
- [ ] Commit

### Steps

**3.1 Create `packages/emails/src/lib/ics.ts`:**

```ts
export interface IcsEventData {
  summary: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string;
  description?: string;
  organizer?: string;
}

/**
 * Generates a valid RFC 5545 VCALENDAR string with a single VEVENT.
 * The dates should be ISO format without timezone suffix (e.g. "2025-06-23T09:00:00").
 * The timezone is specified via the TZID parameter.
 */
export function generateIcs(data: IcsEventData): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}@openschedule`;
  const now = formatIcsDate(new Date().toISOString().slice(0, 19));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenSchedule//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}Z`,
    `DTSTART;TZID=${data.timezone}:${formatIcsDate(data.startDate)}`,
    `DTEND;TZID=${data.timezone}:${formatIcsDate(data.endDate)}`,
    `SUMMARY:${escapeIcsText(data.summary)}`,
  ];

  if (data.location) {
    lines.push(`LOCATION:${escapeIcsText(data.location)}`);
  }

  if (data.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(data.description)}`);
  }

  if (data.organizer) {
    lines.push(`ORGANIZER:mailto:${data.organizer}`);
  }

  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Converts an ISO-ish date string to iCalendar format: "20250623T090000"
 */
function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/[-:]/g, "").replace(/\.\d+/, "");
}

/**
 * Escapes text for iCalendar values (RFC 5545 §3.3.11)
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
```

**3.2 Create `packages/emails/src/lib/calendar-url.ts`:**

```ts
export interface CalendarUrlData {
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string;
  description?: string;
}

/**
 * Builds a Google Calendar "Add Event" URL.
 * Dates should be in compact format: "20250623T090000" (no separators).
 */
export function buildGoogleCalendarUrl(data: CalendarUrlData): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", data.title);
  params.set("dates", `${data.startDate}/${data.endDate}`);
  params.set("ctz", data.timezone);

  if (data.location) {
    params.set("location", data.location);
  }

  if (data.description) {
    params.set("details", data.description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

**3.3 Verify `src/index.ts` exports:**

The `src/index.ts` created in Task 1 already re-exports from `./lib/ics` and `./lib/calendar-url`. No changes needed.

**3.4 Typecheck:**

```bash
pnpm --filter @openschedule/emails typecheck
```

Expected: Passes (templates not yet created, but if `src/index.ts` imports them it will fail — see note in Task 1. Temporarily comment out template exports in `src/index.ts` if needed, or create stub files. Alternatively, create the `src/index.ts` with only lib + component exports for now, and add template exports in Task 4.)

**Pragmatic approach:** Replace `src/index.ts` content temporarily with only what exists so far:

```ts
// Components
export { EmailLayout } from "./components/email-layout";
export { DetailsCard } from "./components/details-card";
export { StaticMap } from "./components/static-map";
export { EmailButton } from "./components/email-button";
export { StatusBadge } from "./components/status-badge";

// Lib
export { generateIcs } from "./lib/ics";
export type { IcsEventData } from "./lib/ics";
export { buildGoogleCalendarUrl } from "./lib/calendar-url";
export type { CalendarUrlData } from "./lib/calendar-url";
```

Then typecheck should pass.

**3.5 Commit:**

```bash
git add packages/emails/src/lib/ packages/emails/src/index.ts
git commit -m "feat(emails): add .ics generator and Google Calendar URL builder"
```

---

## Task 4: Email templates

- [ ] Create `packages/emails/src/templates/booking-created.tsx`
- [ ] Create `packages/emails/src/templates/booking-cancelled.tsx`
- [ ] Create `packages/emails/src/templates/booking-rescheduled.tsx`
- [ ] Create `packages/emails/src/templates/invitation.tsx`
- [ ] Update `src/index.ts` to re-export all templates
- [ ] Run typecheck
- [ ] Commit

### Steps

**4.1 Create `packages/emails/src/templates/booking-created.tsx`:**

```tsx
import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { StatusBadge } from "../components/status-badge";
import { DetailsCard } from "../components/details-card";
import { StaticMap } from "../components/static-map";
import { EmailButton } from "../components/email-button";

export interface BookingCreatedProps {
  customerName: string;
  orgName: string;
  serviceName: string;
  date: string;
  time: string;
  therapistName: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  placeId?: string;
  viewUrl: string;
  cancelUrl: string;
  calendarUrl: string;
  googleMapsApiKey?: string;
}

export function BookingCreated(props: BookingCreatedProps) {
  const {
    customerName,
    orgName,
    serviceName,
    date,
    time,
    therapistName,
    address,
    coordinates,
    placeId,
    viewUrl,
    cancelUrl,
    calendarUrl,
    googleMapsApiKey,
  } = props;

  const detailItems = [
    { label: "Service", value: serviceName },
    { label: "Date", value: date },
    { label: "Time", value: time },
    { label: "Therapist", value: therapistName },
  ];

  if (address) {
    detailItems.push({ label: "Location", value: address });
  }

  return (
    <EmailLayout orgName={orgName}>
      <StatusBadge status="confirmed" />
      <Text style={headline}>Your booking is confirmed</Text>
      <Text style={subheading}>
        Hi {customerName}, here are your appointment details.
      </Text>

      <DetailsCard items={detailItems} />

      {coordinates && googleMapsApiKey ? (
        <StaticMap
          coordinates={coordinates}
          address={address ?? ""}
          placeId={placeId}
          apiKey={googleMapsApiKey}
        />
      ) : null}

      <Section style={buttonGroup}>
        <EmailButton href={viewUrl} variant="primary">
          View Booking
        </EmailButton>
      </Section>
      <Section style={buttonGroup}>
        <EmailButton href={calendarUrl} variant="secondary">
          Add to Calendar
        </EmailButton>
      </Section>

      <Text style={cancelText}>
        Need to cancel?{" "}
        <Link href={cancelUrl} style={cancelLink}>
          Cancel your booking
        </Link>
      </Text>
    </EmailLayout>
  );
}

export function bookingCreatedPlainText(props: BookingCreatedProps): string {
  const lines = [
    `Hi ${props.customerName},`,
    ``,
    `Your booking has been confirmed.`,
    ``,
    `Booking details:`,
    `Service: ${props.serviceName}`,
    `Date: ${props.date}`,
    `Time: ${props.time}`,
    `Therapist: ${props.therapistName}`,
  ];

  if (props.address) {
    lines.push(`Location: ${props.address}`);
  }

  lines.push(
    ``,
    `View your booking:`,
    props.viewUrl,
    ``,
    `Add to Google Calendar:`,
    props.calendarUrl,
    ``,
    `Need to cancel? Use this link:`,
    props.cancelUrl,
  );

  return lines.join("\n");
}

const headline: React.CSSProperties = {
  color: "#18181b",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const subheading: React.CSSProperties = {
  color: "#71717a",
  fontSize: "14px",
  margin: "0 0 8px",
};

const buttonGroup: React.CSSProperties = {
  marginBottom: "12px",
};

const cancelText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  marginTop: "24px",
};

const cancelLink: React.CSSProperties = {
  color: "#71717a",
  textDecoration: "underline",
};
```

**4.2 Create `packages/emails/src/templates/booking-cancelled.tsx`:**

```tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { StatusBadge } from "../components/status-badge";
import { DetailsCard } from "../components/details-card";
import { EmailButton } from "../components/email-button";

export interface BookingCancelledProps {
  recipientName: string;
  orgName: string;
  serviceName: string;
  date: string;
  time: string;
  therapistName: string;
  rebookUrl: string;
}

export function BookingCancelled(props: BookingCancelledProps) {
  const {
    recipientName,
    orgName,
    serviceName,
    date,
    time,
    therapistName,
    rebookUrl,
  } = props;

  const detailItems = [
    { label: "Service", value: serviceName },
    { label: "Date", value: date },
    { label: "Time", value: time },
    { label: "Therapist", value: therapistName },
  ];

  return (
    <EmailLayout orgName={orgName}>
      <StatusBadge status="cancelled" />
      <Text style={headline}>Your booking has been cancelled</Text>
      <Text style={subheading}>
        Hi {recipientName}, the following appointment has been cancelled.
      </Text>

      <DetailsCard items={detailItems} />

      <Section style={buttonGroup}>
        <EmailButton href={rebookUrl} variant="primary">
          Book Again
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}

export function bookingCancelledPlainText(props: BookingCancelledProps): string {
  return [
    `Hi ${props.recipientName},`,
    ``,
    `Your booking has been cancelled.`,
    ``,
    `Booking details:`,
    `Service: ${props.serviceName}`,
    `Date: ${props.date}`,
    `Time: ${props.time}`,
    `Therapist: ${props.therapistName}`,
    ``,
    `Book again:`,
    props.rebookUrl,
  ].join("\n");
}

const headline: React.CSSProperties = {
  color: "#18181b",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const subheading: React.CSSProperties = {
  color: "#71717a",
  fontSize: "14px",
  margin: "0 0 8px",
};

const buttonGroup: React.CSSProperties = {
  marginBottom: "12px",
};
```

**4.3 Create `packages/emails/src/templates/booking-rescheduled.tsx`:**

```tsx
import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { StatusBadge } from "../components/status-badge";
import { DetailsCard } from "../components/details-card";
import { StaticMap } from "../components/static-map";
import { EmailButton } from "../components/email-button";

export interface BookingRescheduledProps {
  recipientName: string;
  orgName: string;
  serviceName: string;
  date: string;
  time: string;
  therapistName: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  placeId?: string;
  viewUrl: string;
  cancelUrl: string;
  calendarUrl: string;
  googleMapsApiKey?: string;
}

export function BookingRescheduled(props: BookingRescheduledProps) {
  const {
    recipientName,
    orgName,
    serviceName,
    date,
    time,
    therapistName,
    address,
    coordinates,
    placeId,
    viewUrl,
    cancelUrl,
    calendarUrl,
    googleMapsApiKey,
  } = props;

  const detailItems = [
    { label: "Service", value: serviceName },
    { label: "New Date", value: date },
    { label: "New Time", value: time },
    { label: "Therapist", value: therapistName },
  ];

  if (address) {
    detailItems.push({ label: "Location", value: address });
  }

  return (
    <EmailLayout orgName={orgName}>
      <StatusBadge status="rescheduled" />
      <Text style={headline}>Your booking has been rescheduled</Text>
      <Text style={subheading}>
        Hi {recipientName}, your appointment has moved to a new time.
      </Text>

      <DetailsCard items={detailItems} />

      {coordinates && googleMapsApiKey ? (
        <StaticMap
          coordinates={coordinates}
          address={address ?? ""}
          placeId={placeId}
          apiKey={googleMapsApiKey}
        />
      ) : null}

      <Section style={buttonGroup}>
        <EmailButton href={viewUrl} variant="primary">
          View Booking
        </EmailButton>
      </Section>
      <Section style={buttonGroup}>
        <EmailButton href={calendarUrl} variant="secondary">
          Add to Calendar
        </EmailButton>
      </Section>

      <Text style={cancelText}>
        Need to cancel?{" "}
        <Link href={cancelUrl} style={cancelLink}>
          Cancel your booking
        </Link>
      </Text>
    </EmailLayout>
  );
}

export function bookingRescheduledPlainText(
  props: BookingRescheduledProps,
): string {
  const lines = [
    `Hi ${props.recipientName},`,
    ``,
    `Your booking has been rescheduled to a new time.`,
    ``,
    `Updated details:`,
    `Service: ${props.serviceName}`,
    `New Date: ${props.date}`,
    `New Time: ${props.time}`,
    `Therapist: ${props.therapistName}`,
  ];

  if (props.address) {
    lines.push(`Location: ${props.address}`);
  }

  lines.push(
    ``,
    `View your booking:`,
    props.viewUrl,
    ``,
    `Add to Google Calendar:`,
    props.calendarUrl,
    ``,
    `Need to cancel? Use this link:`,
    props.cancelUrl,
  );

  return lines.join("\n");
}

const headline: React.CSSProperties = {
  color: "#18181b",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const subheading: React.CSSProperties = {
  color: "#71717a",
  fontSize: "14px",
  margin: "0 0 8px",
};

const buttonGroup: React.CSSProperties = {
  marginBottom: "12px",
};

const cancelText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  marginTop: "24px",
};

const cancelLink: React.CSSProperties = {
  color: "#71717a",
  textDecoration: "underline",
};
```

**4.4 Create `packages/emails/src/templates/invitation.tsx`:**

```tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { DetailsCard } from "../components/details-card";
import { EmailButton } from "../components/email-button";

export interface InvitationProps {
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
}

export function Invitation(props: InvitationProps) {
  const { inviterName, organizationName, acceptUrl } = props;

  const detailItems = [
    { label: "Organization", value: organizationName },
    { label: "Invited by", value: inviterName },
    { label: "Role", value: "Therapist" },
  ];

  return (
    <EmailLayout orgName="OpenSchedule">
      <Text style={headline}>You've been invited to join a team</Text>
      <Text style={subheading}>
        {inviterName} has invited you to join {organizationName} on
        OpenSchedule.
      </Text>

      <DetailsCard items={detailItems} />

      <Section style={buttonGroup}>
        <EmailButton href={acceptUrl} variant="primary">
          Accept Invitation
        </EmailButton>
      </Section>

      <Text style={footerNote}>
        If you don't have an account, you'll be prompted to create one.
      </Text>
    </EmailLayout>
  );
}

export function invitationPlainText(props: InvitationProps): string {
  return [
    `Hi,`,
    ``,
    `${props.inviterName} has invited you to join ${props.organizationName} on OpenSchedule.`,
    ``,
    `Organization: ${props.organizationName}`,
    `Invited by: ${props.inviterName}`,
    `Role: Therapist`,
    ``,
    `Click the link below to accept the invitation:`,
    props.acceptUrl,
    ``,
    `If you don't have an account yet, you'll be prompted to create one.`,
  ].join("\n");
}

const headline: React.CSSProperties = {
  color: "#18181b",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const subheading: React.CSSProperties = {
  color: "#71717a",
  fontSize: "14px",
  margin: "0 0 8px",
};

const buttonGroup: React.CSSProperties = {
  marginBottom: "12px",
};

const footerNote: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: "12px",
  marginTop: "24px",
};
```

**4.5 Update `packages/emails/src/index.ts`:**

Restore the full exports (as written in Task 1 step 1.3):

```ts
// Templates
export { BookingCreated, bookingCreatedPlainText } from "./templates/booking-created";
export type { BookingCreatedProps } from "./templates/booking-created";
export { BookingCancelled, bookingCancelledPlainText } from "./templates/booking-cancelled";
export type { BookingCancelledProps } from "./templates/booking-cancelled";
export { BookingRescheduled, bookingRescheduledPlainText } from "./templates/booking-rescheduled";
export type { BookingRescheduledProps } from "./templates/booking-rescheduled";
export { Invitation, invitationPlainText } from "./templates/invitation";
export type { InvitationProps } from "./templates/invitation";

// Components
export { EmailLayout } from "./components/email-layout";
export { DetailsCard } from "./components/details-card";
export { StaticMap } from "./components/static-map";
export { EmailButton } from "./components/email-button";
export { StatusBadge } from "./components/status-badge";

// Lib
export { generateIcs } from "./lib/ics";
export type { IcsEventData } from "./lib/ics";
export { buildGoogleCalendarUrl } from "./lib/calendar-url";
export type { CalendarUrlData } from "./lib/calendar-url";
```

**4.6 Typecheck:**

```bash
pnpm --filter @openschedule/emails typecheck
```

Expected: All clear.

**4.7 Commit:**

```bash
git add packages/emails/src/templates/ packages/emails/src/index.ts
git commit -m "feat(emails): add all four email templates"
```

---

## Task 5: Upgrade `sendEmail` helper

- [ ] Add `html?` and `attachments?` fields to `EmailPayload` interface
- [ ] Update the Resend API fetch body to include `html` and `attachments` when present
- [ ] Update dev-mode logging to show `[HTML]` indicator
- [ ] Add `@openschedule/emails` as dependency to `packages/convex/package.json`
- [ ] Run `pnpm install`
- [ ] Run typecheck
- [ ] Commit

### Steps

**5.1 Edit `packages/convex/src/actions/email.ts`:**

Replace the entire file with:

```ts
"use node";

export interface EmailPayload {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type?: string;
  }>;
}

/**
 * Sends an email via Resend HTTP API.
 * If RESEND_API_KEY is not set, logs the email content (dev mode).
 * Never throws — failed sends are logged but swallowed.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.TRANSACTIONAL_FROM_EMAIL ?? "noreply@notifications.opencal.xyz";

  if (!apiKey) {
    console.log("[EMAIL DEV MODE] Would send email:");
    console.log(`  To: ${payload.to.join(", ")}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Format: ${payload.html ? "[HTML]" : "[Plain Text]"}`);
    console.log(`  Body: ${payload.text}`);
    if (payload.attachments && payload.attachments.length > 0) {
      console.log(
        `  Attachments: ${payload.attachments.map((a) => a.filename).join(", ")}`,
      );
    }
    return true;
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    };

    if (payload.html) {
      body.html = payload.html;
    }

    if (payload.attachments && payload.attachments.length > 0) {
      body.attachments = payload.attachments;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[EMAIL ERROR] Resend API returned ${response.status}: ${errorBody}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL ERROR] Failed to send email:", error);
    return false;
  }
}
```

**5.2 Add `@openschedule/emails` dependency to `packages/convex/package.json`:**

Add to the `"dependencies"` object:

```json
"@openschedule/emails": "workspace:*"
```

The dependencies section becomes:

```json
"dependencies": {
  "@convex-dev/better-auth": "^0.12.4",
  "@openschedule/emails": "workspace:*",
  "better-auth": "^1.6.18",
  "convex": "^1.21.0",
  "date-fns": "^4.1.0",
  "date-fns-tz": "^3.2.0"
}
```

**5.3 Install and typecheck:**

```bash
cd /Users/xen.n-ian/projects/openschedule && pnpm install
pnpm --filter @openschedule/convex typecheck
```

Expected: typecheck passes (may have pre-existing errors in auth.ts:15 and triggers.ts:3 — those are known and acceptable).

**5.4 Commit:**

```bash
git add packages/convex/src/actions/email.ts packages/convex/package.json pnpm-lock.yaml
git commit -m "feat(convex): upgrade sendEmail to support HTML and attachments"
```

---

## Task 6: Rewrite `sendBookingCreatedEmail`

- [ ] Import render, template, plainText, ics, and calendarUrl from `@openschedule/emails`
- [ ] Resolve additional data: service name, venue address/coordinates/placeId
- [ ] Format date/time with date-fns
- [ ] Build calendarUrl and generate .ics string
- [ ] Render HTML template
- [ ] Call sendEmail with html + attachments
- [ ] Run typecheck
- [ ] Run tests
- [ ] Commit

### Steps

**6.1 Edit `packages/convex/src/actions/sendBookingCreatedEmail.ts`:**

Replace the entire file with:

```ts
"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { format, parse } from "date-fns";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import {
  BookingCreated,
  bookingCreatedPlainText,
  generateIcs,
  buildGoogleCalendarUrl,
} from "@openschedule/emails";

export const send = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} not found, skipping created email`,
      );
      return;
    }

    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    // Honor the org's email-notification gate (default to enabled)
    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );
    if (settings && !settings.emailNotificationsEnabled) return;

    const organization = await ctx.runQuery(
      internal.queries.internal.organizations.getInternal,
      { id: venue.orgId },
    );
    if (!organization) return;

    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );
    if (!customer || !therapist) return;

    if (!booking.cancelToken) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} has no cancelToken, skipping created email`,
      );
      return;
    }

    // Resolve service name
    let serviceName = "Appointment";
    if (booking.serviceId) {
      const service = await ctx.runQuery(
        internal.queries.internal.services.getInternal,
        { id: booking.serviceId },
      );
      if (service) {
        serviceName = service.name;
      }
    }

    // Format date and time
    const parsedDate = parse(booking.date, "yyyy-MM-dd", new Date());
    const formattedDate = format(parsedDate, "EEEE, MMMM d, yyyy");
    const formattedTime = `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;

    // Build URLs
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`;

    // Venue location data
    const address = venue.address;
    const coordinates =
      venue.latitude != null && venue.longitude != null
        ? { lat: venue.latitude, lng: venue.longitude }
        : undefined;
    const placeId = venue.placeId;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Build Google Calendar URL
    const startDateTime = `${booking.date.replace(/-/g, "")}T${booking.startTime.replace(/:/g, "")}00`;
    const endDateTime = `${booking.date.replace(/-/g, "")}T${booking.endTime.replace(/:/g, "")}00`;
    const timezone = venue.timezone ?? "UTC";

    const calendarUrl = buildGoogleCalendarUrl({
      title: `${serviceName} — ${organization.name}`,
      startDate: startDateTime,
      endDate: endDateTime,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Generate .ics file
    const icsContent = generateIcs({
      summary: `${serviceName} — ${organization.name}`,
      startDate: `${booking.date}T${booking.startTime}:00`,
      endDate: `${booking.date}T${booking.endTime}:00`,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Template props
    const templateProps = {
      customerName: customer.name,
      orgName: organization.name,
      serviceName,
      date: formattedDate,
      time: formattedTime,
      therapistName: therapist.name,
      address,
      coordinates,
      placeId,
      viewUrl,
      cancelUrl,
      calendarUrl,
      googleMapsApiKey,
    };

    // Render HTML
    const html = await render(BookingCreated(templateProps));
    const text = bookingCreatedPlainText(templateProps);

    const subject = `Booking confirmed — ${formattedDate}`;

    await sendEmail({
      to: [customer.email],
      subject,
      text,
      html,
      attachments: [
        {
          filename: "booking.ics",
          content: Buffer.from(icsContent).toString("base64"),
          content_type: "text/calendar",
        },
      ],
    });
  },
});

/**
 * Formats "HH:MM" (24h) to "h:mm AM/PM"
 */
function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  const minutes = minutesStr ?? "00";
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes} ${period}`;
}
```

**6.2 Typecheck:**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: passes (known pre-existing errors are acceptable).

**6.3 Run tests:**

```bash
pnpm --filter @openschedule/convex test
```

Expected: 46/46 tests pass.

**6.4 Commit:**

```bash
git add packages/convex/src/actions/sendBookingCreatedEmail.ts
git commit -m "feat(convex): booking created email with HTML template and .ics"
```

---

## Task 7: Rewrite `sendBookingNotification` + consolidate betterAuth invitation

- [ ] Rewrite `sendBookingNotification` with cancelled + rescheduled templates
- [ ] Rewrite `sendInvitationEmail` action with invitation template
- [ ] Replace inline fetch in `betterAuth/auth.ts` with shared `sendEmail` helper + template render
- [ ] Run typecheck
- [ ] Run tests
- [ ] Commit

### Steps

**7.1 Edit `packages/convex/src/actions/sendBookingNotification.ts`:**

Replace the entire file with:

```ts
"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { format, parse } from "date-fns";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import {
  BookingCancelled,
  bookingCancelledPlainText,
  BookingRescheduled,
  bookingRescheduledPlainText,
  generateIcs,
  buildGoogleCalendarUrl,
} from "@openschedule/emails";

export const send = internalAction({
  args: {
    bookingId: v.id("bookings"),
    event: v.union(
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("rescheduled"),
    ),
  },
  handler: async (ctx, args) => {
    // Resolve booking data
    const booking = await ctx.runQuery(
      internal.queries.internal.bookings.getInternal,
      { id: args.bookingId },
    );
    if (!booking) {
      console.error(
        `[EMAIL] Booking ${args.bookingId} not found, skipping email`,
      );
      return;
    }

    // Skip if already cancelled and event is not "cancelled"
    if (booking.status === "cancelled" && args.event !== "cancelled") {
      return;
    }

    // Check org notification settings
    const venue = await ctx.runQuery(
      internal.queries.internal.venues.getInternal,
      { id: booking.venueId },
    );
    if (!venue) return;

    const settings = await ctx.runQuery(
      internal.queries.internal.settings.getByOrgInternal,
      { orgId: venue.orgId },
    );

    // Default to enabled when no settings doc exists
    if (settings && !settings.emailNotificationsEnabled) {
      return;
    }

    const organization = await ctx.runQuery(
      internal.queries.internal.organizations.getInternal,
      { id: venue.orgId },
    );
    if (!organization) return;

    // Resolve customer and therapist
    const customer = await ctx.runQuery(
      internal.queries.internal.customers.getInternal,
      { id: booking.customerId },
    );
    const therapist = await ctx.runQuery(
      internal.queries.internal.users.getInternal,
      { id: booking.therapistId },
    );

    if (!customer || !therapist) return;

    // Resolve service name
    let serviceName = "Appointment";
    if (booking.serviceId) {
      const service = await ctx.runQuery(
        internal.queries.internal.services.getInternal,
        { id: booking.serviceId },
      );
      if (service) {
        serviceName = service.name;
      }
    }

    // Format date and time
    const parsedDate = parse(booking.date, "yyyy-MM-dd", new Date());
    const formattedDate = format(parsedDate, "EEEE, MMMM d, yyyy");
    const formattedTime = `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;

    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const orgName = organization.name;

    // For "confirmed" event, we use the same logic as sendBookingCreatedEmail
    // (this case is handled by sendBookingCreatedEmail, but kept for backward compat)
    if (args.event === "confirmed") {
      const subject = `Booking confirmed — ${formattedDate}`;
      const text = `Your booking on ${booking.date} from ${booking.startTime} to ${booking.endTime} with ${therapist.name} has been confirmed.`;
      const recipients = [customer.email, therapist.email].filter(Boolean);
      await sendEmail({ to: recipients, subject, text });
      return;
    }

    if (args.event === "cancelled") {
      const rebookUrl = `${webUrl}/${organization.slug}/${venue.slug}`;

      // Send to customer
      const customerProps = {
        recipientName: customer.name,
        orgName,
        serviceName,
        date: formattedDate,
        time: formattedTime,
        therapistName: therapist.name,
        rebookUrl,
      };

      const customerHtml = await render(BookingCancelled(customerProps));
      const customerText = bookingCancelledPlainText(customerProps);

      await sendEmail({
        to: [customer.email],
        subject: `Booking cancelled — ${formattedDate}`,
        text: customerText,
        html: customerHtml,
      });

      // Send to therapist
      const therapistProps = {
        recipientName: therapist.name,
        orgName,
        serviceName,
        date: formattedDate,
        time: formattedTime,
        therapistName: therapist.name,
        rebookUrl,
      };

      const therapistHtml = await render(BookingCancelled(therapistProps));
      const therapistText = bookingCancelledPlainText(therapistProps);

      await sendEmail({
        to: [therapist.email],
        subject: `Booking cancelled — ${formattedDate}`,
        text: therapistText,
        html: therapistHtml,
      });

      return;
    }

    // args.event === "rescheduled"
    const address = venue.address;
    const coordinates =
      venue.latitude != null && venue.longitude != null
        ? { lat: venue.latitude, lng: venue.longitude }
        : undefined;
    const placeId = venue.placeId;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    const timezone = venue.timezone ?? "UTC";

    const viewUrl = `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}`;
    const cancelUrl = booking.cancelToken
      ? `${webUrl}/${organization.slug}/${venue.slug}/bookings/${booking._id}/cancel?token=${booking.cancelToken}`
      : viewUrl;

    // Build Google Calendar URL
    const startDateTime = `${booking.date.replace(/-/g, "")}T${booking.startTime.replace(/:/g, "")}00`;
    const endDateTime = `${booking.date.replace(/-/g, "")}T${booking.endTime.replace(/:/g, "")}00`;

    const calendarUrl = buildGoogleCalendarUrl({
      title: `${serviceName} — ${orgName}`,
      startDate: startDateTime,
      endDate: endDateTime,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    // Generate .ics file
    const icsContent = generateIcs({
      summary: `${serviceName} — ${orgName}`,
      startDate: `${booking.date}T${booking.startTime}:00`,
      endDate: `${booking.date}T${booking.endTime}:00`,
      timezone,
      location: address,
      description: `Therapist: ${therapist.name}\nService: ${serviceName}`,
    });

    const attachments = [
      {
        filename: "booking.ics",
        content: Buffer.from(icsContent).toString("base64"),
        content_type: "text/calendar",
      },
    ];

    // Send to customer
    const customerReschedProps = {
      recipientName: customer.name,
      orgName,
      serviceName,
      date: formattedDate,
      time: formattedTime,
      therapistName: therapist.name,
      address,
      coordinates,
      placeId,
      viewUrl,
      cancelUrl,
      calendarUrl,
      googleMapsApiKey,
    };

    const customerHtml = await render(BookingRescheduled(customerReschedProps));
    const customerText = bookingRescheduledPlainText(customerReschedProps);

    await sendEmail({
      to: [customer.email],
      subject: `Booking rescheduled — ${formattedDate}`,
      text: customerText,
      html: customerHtml,
      attachments,
    });

    // Send to therapist
    const therapistReschedProps = {
      recipientName: therapist.name,
      orgName,
      serviceName,
      date: formattedDate,
      time: formattedTime,
      therapistName: therapist.name,
      address,
      coordinates,
      placeId,
      viewUrl,
      cancelUrl,
      calendarUrl,
      googleMapsApiKey,
    };

    const therapistHtml = await render(
      BookingRescheduled(therapistReschedProps),
    );
    const therapistText = bookingRescheduledPlainText(therapistReschedProps);

    await sendEmail({
      to: [therapist.email],
      subject: `Booking rescheduled — ${formattedDate}`,
      text: therapistText,
      html: therapistHtml,
      attachments,
    });
  },
});

/**
 * Formats "HH:MM" (24h) to "h:mm AM/PM"
 */
function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  const minutes = minutesStr ?? "00";
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes} ${period}`;
}
```

**7.2 Edit `packages/convex/src/actions/sendInvitationEmail.ts`:**

Replace the entire file with:

```ts
"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import { Invitation, invitationPlainText } from "@openschedule/emails";

export const send = internalAction({
  args: {
    email: v.string(),
    inviterName: v.string(),
    organizationName: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    const acceptUrl = `${appUrl}/invite/${args.invitationId}`;

    const templateProps = {
      inviterName: args.inviterName,
      organizationName: args.organizationName,
      acceptUrl,
    };

    const html = await render(Invitation(templateProps));
    const text = invitationPlainText(templateProps);

    await sendEmail({
      to: [args.email],
      subject: `You've been invited to join ${args.organizationName}`,
      text,
      html,
    });
  },
});
```

**7.3 Edit `packages/convex/src/betterAuth/auth.ts`:**

Replace the inline `sendInvitationEmail` callback (lines 249-301) with:

```ts
        async sendInvitationEmail(data) {
          try {
            const appUrl = process.env.APP_URL ?? "http://localhost:3001";
            const acceptUrl = `${appUrl}/invite/${data.id}`;

            const orgName = data.organization?.name ?? "the organization";
            const inviterName = data.inviter?.user?.name ?? "Someone";

            const templateProps = {
              inviterName,
              organizationName: orgName,
              acceptUrl,
            };

            const { render } = await import("@react-email/render");
            const { Invitation, invitationPlainText } = await import(
              "@openschedule/emails"
            );

            const html = await render(Invitation(templateProps));
            const text = invitationPlainText(templateProps);

            const { sendEmail } = await import("../actions/email");
            await sendEmail({
              to: [data.email],
              subject: `You've been invited to join ${orgName}`,
              text,
              html,
            });
          } catch (error) {
            console.error(
              "[EMAIL ERROR] Failed to send invitation email:",
              error,
            );
          }
        },
```

> **Note:** We use dynamic `import()` here because `auth.ts` is loaded during HTTP request handling and static imports from `@openschedule/emails` might cause bundling issues with the better-auth plugin system. Dynamic imports ensure the modules are resolved at call time. If typecheck reveals that static imports work fine, you can switch to static imports at the top of the file for cleaner code.

**7.4 Typecheck:**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: passes (same pre-existing errors only: auth.ts:15 authComponent, triggers.ts:3 onCreate).

**7.5 Run tests:**

```bash
pnpm --filter @openschedule/convex test
```

Expected: 46/46 tests pass.

**7.6 Commit:**

```bash
git add packages/convex/src/actions/sendBookingNotification.ts packages/convex/src/actions/sendInvitationEmail.ts packages/convex/src/betterAuth/auth.ts
git commit -m "feat(convex): HTML templates for notification and invitation emails"
```

---

## Task 8: Final verification

- [ ] Run `pnpm --filter @openschedule/emails typecheck`
- [ ] Run `pnpm --filter @openschedule/convex typecheck`
- [ ] Run `pnpm --filter @openschedule/convex test`
- [ ] Verify no new errors beyond the 2 pre-existing ones
- [ ] Commit lint/format fixes if needed

### Steps

**8.1 Full typecheck for emails package:**

```bash
pnpm --filter @openschedule/emails typecheck
```

Expected: 0 errors.

**8.2 Full typecheck for convex package:**

```bash
pnpm --filter @openschedule/convex typecheck
```

Expected: Only pre-existing errors:
- `src/betterAuth/auth.ts(15,30)`: `authComponent` type issue
- `src/triggers.ts(3,...)`: `onCreate` type issue

No new errors should appear.

**8.3 Run test suite:**

```bash
pnpm --filter @openschedule/convex test
```

Expected: `46 tests | 46 passed`

**8.4 Verify git status:**

```bash
git status
```

Ensure only intended files are modified. The `packages/convex/src/_generated/` directory is gitignored and should NOT appear in the diff.

**8.5 If lint/format fixes needed:**

```bash
git add -A && git commit -m "chore: lint and format fixes"
```

---

## Summary of files created/modified

### New files (packages/emails/)

| File | Purpose |
|------|---------|
| `packages/emails/package.json` | Package manifest |
| `packages/emails/tsconfig.json` | TypeScript config |
| `packages/emails/src/index.ts` | Barrel exports |
| `packages/emails/src/components/email-layout.tsx` | Html/Body/Container wrapper |
| `packages/emails/src/components/details-card.tsx` | Key-value table card |
| `packages/emails/src/components/static-map.tsx` | Google Static Maps image |
| `packages/emails/src/components/email-button.tsx` | Primary/secondary CTA button |
| `packages/emails/src/components/status-badge.tsx` | Colored status pill |
| `packages/emails/src/lib/ics.ts` | RFC 5545 .ics generator |
| `packages/emails/src/lib/calendar-url.ts` | Google Calendar URL builder |
| `packages/emails/src/templates/booking-created.tsx` | Booking confirmed template |
| `packages/emails/src/templates/booking-cancelled.tsx` | Booking cancelled template |
| `packages/emails/src/templates/booking-rescheduled.tsx` | Booking rescheduled template |
| `packages/emails/src/templates/invitation.tsx` | Team invitation template |

### Modified files (packages/convex/)

| File | Change |
|------|--------|
| `packages/convex/package.json` | Add `@openschedule/emails` dependency |
| `packages/convex/src/actions/email.ts` | Add `html?` and `attachments?` to payload |
| `packages/convex/src/actions/sendBookingCreatedEmail.ts` | Full rewrite with HTML template + .ics |
| `packages/convex/src/actions/sendBookingNotification.ts` | Full rewrite with cancelled/rescheduled templates |
| `packages/convex/src/actions/sendInvitationEmail.ts` | Rewrite with invitation template |
| `packages/convex/src/betterAuth/auth.ts` | Replace inline fetch with shared helper + template |

### Modified root files

| File | Change |
|------|--------|
| `pnpm-lock.yaml` | Updated after adding new package + deps |

---

## Environment variables

Ensure these are set on the Convex deployment:

| Variable | Purpose | Required |
|----------|---------|----------|
| `RESEND_API_KEY` | Resend API authentication | Yes (prod) |
| `TRANSACTIONAL_FROM_EMAIL` | Sender email address | No (has default) |
| `WEB_URL` | Customer-facing app URL | No (defaults to localhost:3000) |
| `APP_URL` | Admin app URL (for invitations) | No (defaults to localhost:3001) |
| `GOOGLE_MAPS_API_KEY` | Static Maps images in emails | No (map omitted if missing) |

---

## Commit sequence

1. `feat(emails): scaffold packages/emails package`
2. `feat(emails): add shared email components`
3. `feat(emails): add .ics generator and Google Calendar URL builder`
4. `feat(emails): add all four email templates`
5. `feat(convex): upgrade sendEmail to support HTML and attachments`
6. `feat(convex): booking created email with HTML template and .ics`
7. `feat(convex): HTML templates for notification and invitation emails`
8. `chore: lint and format fixes` (only if needed)
