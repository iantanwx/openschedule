"use client";

import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization();

  useEffect(() => {
    if (sessionPending || orgPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!activeOrg) {
      router.replace("/onboarding");
      return;
    }

    router.replace(`/${activeOrg.slug}`);
  }, [session, activeOrg, sessionPending, orgPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
