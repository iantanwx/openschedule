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
