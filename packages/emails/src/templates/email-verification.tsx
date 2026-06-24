import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/email-layout";
import { EmailButton } from "../components/email-button";

export interface EmailVerificationProps {
  userName: string;
  verificationUrl: string;
}

export function EmailVerification(props: EmailVerificationProps) {
  const { userName, verificationUrl } = props;

  return (
    <EmailLayout orgName="OpenSchedule">
      <Text style={headline}>Verify your email address</Text>
      <Text style={subheading}>
        Hi {userName}, please verify your email to complete your account setup.
      </Text>

      <Section style={buttonGroup}>
        <EmailButton href={verificationUrl} variant="primary">
          Verify Email
        </EmailButton>
      </Section>

      <Text style={footerNote}>
        If you didn&apos;t create an account on OpenSchedule, you can safely
        ignore this email.
      </Text>
    </EmailLayout>
  );
}

export function emailVerificationPlainText(props: EmailVerificationProps): string {
  return [
    `Hi ${props.userName},`,
    ``,
    `Please verify your email address by clicking the link below:`,
    props.verificationUrl,
    ``,
    `If you didn't create an account on OpenSchedule, you can safely ignore this email.`,
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
