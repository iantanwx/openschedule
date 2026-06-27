"use client";

import { useQuery, useMutation } from "convex/react";
import { useSession } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@opencal/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@opencal/ui/components/card";
import { Avatar, AvatarFallback } from "@opencal/ui/components/avatar";
import { Badge } from "@opencal/ui/components/badge";
import { ArrowLeft } from "lucide-react";

export function AccountPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const integration = useQuery(convexApi.queries.integrations.getByCurrentUser);
  const disconnectMutation = useMutation(convexApi.mutations.integrations.disconnect);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleDisconnect() {
    await disconnectMutation();
  }

  function handleConnect() {
    window.location.href = "/api/integrations/google/authorize";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Account Settings</h1>

        {/* Success/error banners */}
        {connected === "google-calendar" && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Google Calendar connected successfully.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Failed to connect Google Calendar. Please try again.
          </div>
        )}

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{userName}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </CardContent>
        </Card>

        {/* Integrations Section */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V8.25h15v11.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    Sync confirmed bookings to your calendar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration?.enabled ? (
                  <>
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      Connected
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleConnect}>
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
