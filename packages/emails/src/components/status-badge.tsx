import { Text } from "@react-email/components";

interface StatusBadgeProps {
  status: "confirmed" | "cancelled" | "rescheduled";
}

const statusConfig = {
  confirmed: { bg: "#dcfce7", color: "#166534", label: "Confirmed" },
  cancelled: { bg: "#fef2f2", color: "#991b1b", label: "Cancelled" },
  rescheduled: { bg: "#eff6ff", color: "#1e40af", label: "Rescheduled" },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Text
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: "12px",
        fontWeight: "600",
        padding: "4px 12px",
        borderRadius: "9999px",
        display: "inline-block",
        margin: "0 0 16px",
      }}
    >
      {config.label}
    </Text>
  );
}
