"use client";

import { authClient, useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function RootPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization();
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (sessionPending || orgPending) return;
    if (resolvingRef.current) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (activeOrg) {
      router.replace(`/${activeOrg.slug}`);
      return;
    }

    // No active org — check if user has any organizations
    resolvingRef.current = true;
    authClient.organization.list().then((result: { data?: Array<{ id: string; slug: string }> }) => {
      const orgs = result.data;
      if (orgs && orgs.length > 0) {
        const firstOrg = orgs[0];
        // Set first org as active, then redirect
        authClient.organization.setActive({ organizationId: firstOrg.id }).then(() => {
          router.replace(`/${firstOrg.slug}`);
        });
      } else {
        router.replace("/onboarding");
      }
      resolvingRef.current = false;
    });
  }, [session, activeOrg, sessionPending, orgPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
