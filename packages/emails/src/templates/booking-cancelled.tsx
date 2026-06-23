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
