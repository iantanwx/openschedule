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
