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
