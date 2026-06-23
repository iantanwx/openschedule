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
