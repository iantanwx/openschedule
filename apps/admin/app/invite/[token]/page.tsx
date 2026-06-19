import { use } from "react";
import { InvitePage } from "./invite-page";

export default function InviteRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <InvitePage token={token} />;
}
