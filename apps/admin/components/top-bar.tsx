"use client";

import { useActiveOrganization } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@openschedule/ui/components/avatar";
import { useSession } from "@/lib/auth-client";

export function TopBar() {
  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();

  const orgName = activeOrg?.name ?? "Organization";
  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <h1 className="text-lg font-semibold">{orgName}</h1>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </header>
  );
}
