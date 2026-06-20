"use node";

import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

interface TokenConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface Integration {
  _id: string;
  config: TokenConfig;
  enabled: boolean;
}

interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Refresh the access token if expired or close to expiry (within 60s).
 * Returns the current (or refreshed) access token.
 * Throws if refresh fails (caller should catch and disable integration).
 */
export async function refreshTokenIfNeeded(
  ctx: ActionCtx,
  integration: Integration,
): Promise<string> {
  const config = integration.config;
  const now = Date.now();

  // If token is still valid (more than 60s remaining), return it
  if (config.expiresAt - now > 60_000) {
    return config.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  const newConfig: TokenConfig = {
    accessToken: data.access_token,
    refreshToken: config.refreshToken, // Google doesn't always return a new refresh token
    expiresAt: now + data.expires_in * 1000,
  };

  // Persist the refreshed token
  await ctx.runMutation(internal.mutations.integrations.updateConfig, {
    id: integration._id as any,
    config: newConfig,
  });

  return newConfig.accessToken;
}

/**
 * Create a calendar event on the user's primary calendar.
 * Returns the event ID.
 */
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent,
): Promise<string> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Calendar create event failed (${response.status}): ${errorBody}`,
    );
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

/**
 * Delete a calendar event from the user's primary calendar.
 * Silently succeeds if the event is already deleted (410 Gone).
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  // 204 = success, 410 = already deleted — both are fine
  if (!response.ok && response.status !== 410) {
    const errorBody = await response.text();
    throw new Error(
      `Google Calendar delete event failed (${response.status}): ${errorBody}`,
    );
  }
}
