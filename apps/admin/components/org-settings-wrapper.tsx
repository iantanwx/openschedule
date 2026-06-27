"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { OrgSettingsForm } from "./org-settings-form";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@opencal/ui/components/button";
import { Spinner } from "@opencal/ui/components/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@opencal/ui/components/card";

interface OrgSettingsWrapperProps {
  orgSlug: string;
}

export function OrgSettingsWrapper({ orgSlug }: OrgSettingsWrapperProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const org = useQuery(convexApi.queries.organizations.getBySlug, {
    slug: orgSlug,
  });

  if (!org) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <OrgSettingsForm orgId={org._id} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {session?.user?.name ?? "Unknown"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {session?.user?.email ?? "Unknown"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
