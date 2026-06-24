"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { formatNotification } from "@/lib/format-notification";
import { Button } from "@openschedule/ui/components/button";
import { Spinner } from "@openschedule/ui/components/spinner";

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationList() {
  const notifications = useQuery(convexApi.queries.notifications.listRecent, { limit: 20 });
  const markRead = useMutation(convexApi.mutations.notifications.markRead);
  const markAllRead = useMutation(convexApi.mutations.notifications.markAllRead);

  if (notifications === undefined) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No notifications yet
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex max-h-96 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => markAllRead({})}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {notifications.map((notification) => {
          const { icon: Icon, text } = formatNotification(
            notification.type,
            notification.payload as Record<string, unknown>,
          );
          return (
            <button
              key={notification._id}
              onClick={() => {
                if (!notification.read) {
                  markRead({ id: notification._id });
                }
              }}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                !notification.read ? "bg-accent/50" : ""
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight">{text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {relativeTime(notification.createdAt)}
                </p>
              </div>
              {!notification.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
