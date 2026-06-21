"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { formatNotification } from "@/lib/format-notification";

export function NotificationToast() {
  const notifications = useQuery(convexApi.queries.notifications.listRecent, { limit: 1 });
  const lastSeenRef = useRef<number>(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const latest = notifications[0];
    if (!latest) return;

    if (!mountedRef.current) {
      lastSeenRef.current = latest.createdAt;
      mountedRef.current = true;
      return;
    }

    if (latest.createdAt > lastSeenRef.current) {
      lastSeenRef.current = latest.createdAt;
      const { text } = formatNotification(
        latest.type,
        latest.payload as Record<string, unknown>,
      );
      toast(text, { duration: 5000 });
    }
  }, [notifications]);

  return null;
}
