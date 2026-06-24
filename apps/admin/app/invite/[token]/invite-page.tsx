"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";

export function InvitePage({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<"idle" | "accepting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectTo = `/invite/${token}`;

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(`/signup?next=${encodeURIComponent(redirectTo)}`);
    }
  }, [isPending, session, redirectTo, router]);

  async function handleAccept() {
    setStatus("accepting");
    setErrorMsg(null);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId: token,
      });
      if (result.error) {
        setStatus("error");
        setErrorMsg(result.error.message ?? "Failed to accept invitation");
        return;
      }
      router.replace("/");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invitation");
    }
  }

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;ve been invited</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accept your invitation to join the organization on OpenSchedule.
          </p>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <Button
            onClick={handleAccept}
            className="w-full"
            disabled={status === "accepting"}
          >
            {status === "accepting" ? "Accepting..." : "Accept invitation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
