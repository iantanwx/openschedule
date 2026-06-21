import { use } from "react";
import { ServicesPage } from "@/components/services-page";

export default function ServicesRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  return <ServicesPage orgSlug={orgSlug} />;
}
