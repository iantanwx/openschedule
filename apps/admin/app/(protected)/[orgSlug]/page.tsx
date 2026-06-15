"use client";

import { use } from "react";
import { useSession, useActiveOrganization, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@openschedule/ui/components/button";

export default function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6 text-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Authenticated as:</span>{" "}
            {session?.user?.name ?? "Unknown"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {session?.user?.email ?? "Unknown"}
          </p>
          <p>
            <span className="text-muted-foreground">Organization:</span>{" "}
            {activeOrg?.name ?? orgSlug}
          </p>
        </div>

        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
