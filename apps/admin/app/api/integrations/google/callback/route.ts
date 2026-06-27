import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchMutation } from "convex/nextjs";
import { api } from "@opencal/convex/api";
import { getAppUrl } from "@/lib/get-app-url";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = getAppUrl();
  const accountUrl = `${appUrl}/account`;

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    return NextResponse.redirect(
      `${accountUrl}?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${accountUrl}?error=missing_params`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${accountUrl}?error=invalid_state`);
  }

  // Clear the state cookie
  cookieStore.delete("google_oauth_state");

  // Exchange code for tokens
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/integrations/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${accountUrl}?error=server_config`);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("[GOOGLE OAUTH] Token exchange failed:", errorBody);
    return NextResponse.redirect(`${accountUrl}?error=token_exchange`);
  }

  const tokenData = await tokenResponse.json();

  // Get the auth token from the request cookies to authenticate the Convex mutation
  const authToken =
    request.cookies.get("__Secure-better-auth.session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value;

  if (!authToken) {
    return NextResponse.redirect(`${accountUrl}?error=not_authenticated`);
  }

  // Store tokens in Convex
  try {
    await fetchMutation(
      api.mutations.integrations.upsert as any,
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      },
      { token: authToken },
    );
  } catch (err) {
    console.error("[GOOGLE OAUTH] Failed to store tokens:", err);
    return NextResponse.redirect(`${accountUrl}?error=storage_failed`);
  }

  return NextResponse.redirect(`${accountUrl}?connected=google-calendar`);
}
