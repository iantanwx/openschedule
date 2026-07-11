import { Section, Text, Img, Hr } from "@react-email/components";

interface PaymentInfoEmailProps {
  type: "bank_account" | "qr_code";
  label: string;
  holderName?: string;
  bankName?: string;
  accountNumber?: string;
  reference?: string;
  method?: string;
  identifierType?: string;
  identifierValue?: string;
  imageUrl?: string;
  notes?: string;
}

export function PaymentInfoEmail(props: PaymentInfoEmailProps) {
  const { type, label } = props;

  return (
    <Section style={container}>
      <Hr style={divider} />
      <Text style={heading}>Payment Instructions</Text>

      {type === "bank_account" && (
        <>
          {props.bankName && (
            <Text style={row}>
              <span style={rowLabel}>Bank:</span> {props.bankName}
            </Text>
          )}
          {props.holderName && (
            <Text style={row}>
              <span style={rowLabel}>Account Holder:</span> {props.holderName}
            </Text>
          )}
          {props.accountNumber && (
            <Text style={row}>
              <span style={rowLabel}>Account Number:</span>{" "}
              <span style={mono}>{props.accountNumber}</span>
            </Text>
          )}
          {props.reference && (
            <Text style={note}>{props.reference}</Text>
          )}
        </>
      )}

      {type === "qr_code" && (
        <>
          {props.imageUrl && (
            <Img
              src={props.imageUrl}
              alt={`${label} QR code`}
              width="200"
              height="200"
              style={qrImage}
            />
          )}
          {props.method && (
            <Text style={row}>
              <span style={rowLabel}>Method:</span> {props.method}
            </Text>
          )}
          {props.identifierType && props.identifierValue && (
            <Text style={row}>
              <span style={rowLabel}>{props.identifierType === "phone" ? "Phone" : "UEN"}:</span>{" "}
              <span style={mono}>{props.identifierValue}</span>
            </Text>
          )}
          {props.notes && (
            <Text style={note}>{props.notes}</Text>
          )}
        </>
      )}
    </Section>
  );
}

export function paymentInfoPlainText(props: PaymentInfoEmailProps): string {
  const lines = ["", "Payment Instructions:", `Method: ${props.label}`];

  if (props.type === "bank_account") {
    if (props.bankName) lines.push(`Bank: ${props.bankName}`);
    if (props.holderName) lines.push(`Account Holder: ${props.holderName}`);
    if (props.accountNumber) lines.push(`Account Number: ${props.accountNumber}`);
    if (props.reference) lines.push(`Note: ${props.reference}`);
  } else {
    if (props.method) lines.push(`Provider: ${props.method}`);
    if (props.identifierType && props.identifierValue) {
      lines.push(`${props.identifierType === "phone" ? "Phone" : "UEN"}: ${props.identifierValue}`);
    }
    if (props.notes) lines.push(`Note: ${props.notes}`);
  }

  return lines.join("\n");
}

const container: React.CSSProperties = { marginTop: "24px" };
const divider: React.CSSProperties = { borderColor: "#e4e4e7", margin: "0 0 16px" };
const heading: React.CSSProperties = { color: "#18181b", fontSize: "14px", fontWeight: "600", margin: "0 0 12px" };
const row: React.CSSProperties = { color: "#3f3f46", fontSize: "13px", margin: "0 0 6px", lineHeight: "20px" };
const rowLabel: React.CSSProperties = { color: "#71717a" };
const mono: React.CSSProperties = { fontFamily: "monospace" };
const note: React.CSSProperties = { color: "#71717a", fontSize: "12px", margin: "8px 0 0", fontStyle: "italic" };
const qrImage: React.CSSProperties = { margin: "0 auto 12px", display: "block", borderRadius: "8px", border: "1px solid #e4e4e7" };
