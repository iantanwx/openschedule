"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient, useActiveOrganization } from "@/lib/auth-client";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";

interface Org {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher() {
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    authClient.organization.list().then((result: { data?: Org[] }) => {
      if (result.data) {
        setOrgs(result.data);
      }
    });
  }, []);

  const orgName = activeOrg?.name ?? "Organization";
  const orgInitial = orgName.charAt(0).toUpperCase();

  async function handleSwitch(org: Org) {
    await authClient.organization.setActive({ organizationId: org.id });
    router.push(`/${org.slug}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
          {orgInitial}
        </span>
        <span className="flex-1 truncate text-sm font-medium">{orgName}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            {activeOrg?.id === org.id && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {orgs.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => router.push("/onboarding")} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
