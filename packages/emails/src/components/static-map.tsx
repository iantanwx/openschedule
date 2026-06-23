import { Section, Img, Text, Link } from "@react-email/components";

interface StaticMapProps {
  coordinates: { lat: number; lng: number };
  address: string;
  placeId?: string;
  apiKey: string;
}

export function StaticMap({
  coordinates,
  address,
  placeId,
  apiKey,
}: StaticMapProps) {
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=15&size=480x140&scale=2&markers=color:red%7C${coordinates.lat},${coordinates.lng}&key=${apiKey}`;

  const directionsUrl = placeId
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&destination_place_id=${placeId}`
    : `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;

  return (
    <Section style={mapSection}>
      <Img
        src={mapUrl}
        alt={`Map showing ${address}`}
        width="480"
        height="140"
        style={mapImage}
      />
      <Text style={addressText}>{address}</Text>
      <Link href={directionsUrl} style={directionsLink}>
        Get directions →
      </Link>
    </Section>
  );
}

const mapSection: React.CSSProperties = {
  margin: "24px 0",
};

const mapImage: React.CSSProperties = {
  width: "100%",
  height: "auto",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};

const addressText: React.CSSProperties = {
  color: "#18181b",
  fontSize: "13px",
  margin: "8px 0 4px",
};

const directionsLink: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  textDecoration: "none",
};
