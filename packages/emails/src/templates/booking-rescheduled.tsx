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
