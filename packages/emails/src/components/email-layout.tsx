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
