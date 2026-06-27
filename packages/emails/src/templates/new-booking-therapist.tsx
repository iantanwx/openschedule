import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { DetailsCard } from "../components/details-card";
import { EmailButton } from "../components/email-button";

export interface NewBookingTherapistProps {
  therapistName: string;
  orgName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceName: string;
  date: string;
  time: string;
  venueName: string;
  dashboardUrl: string;
}

export function NewBookingTherapist(props: NewBookingTherapistProps) {
  const {
    therapistName,
    orgName,
    customerName,
    customerEmail,
    customerPhone,
    serviceName,
    date,
    time,
    venueName,
    dashboardUrl,
  } = props;

  const detailItems = [
    { label: "Customer", value: customerName },
    { label: "Email", value: customerEmail },
    ...(customerPhone ? [{ label: "Phone", value: customerPhone }] : []),
    { label: "Service", value: serviceName },
    { label: "Date", value: date },
    { label: "Time", value: time },
    { label: "Venue", value: venueName },
  ];

  return (
    <EmailLayout orgName={orgName}>
      <Text style={headline}>New booking received</Text>
      <Text style={subheading}>
        Hi {therapistName}, you have a new appointment.
      </Text>

      <DetailsCard items={detailItems} />

      <Section style={buttonGroup}>
        <EmailButton href={dashboardUrl} variant="primary">
          View in Dashboard
        </EmailButton>
      </Section>

      <Text style={footerText}>
        This booking has been automatically confirmed. If you need to reschedule
        or cancel, use the dashboard link above.
      </Text>
    </EmailLayout>
  );
}

export function newBookingTherapistPlainText(
  props: NewBookingTherapistProps,
): string {
  const lines = [
    `Hi ${props.therapistName},`,
    ``,
    `You have a new booking.`,
    ``,
    `Details:`,
    `Customer: ${props.customerName}`,
    `Email: ${props.customerEmail}`,
  ];

  if (props.customerPhone) {
    lines.push(`Phone: ${props.customerPhone}`);
  }

  lines.push(
    `Service: ${props.serviceName}`,
    `Date: ${props.date}`,
    `Time: ${props.time}`,
    `Venue: ${props.venueName}`,
    ``,
    `View in dashboard:`,
    props.dashboardUrl,
    ``,
    `This booking has been automatically confirmed. If you need to reschedule or cancel, use the dashboard link above.`,
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

const footerText: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  marginTop: "24px",
};
