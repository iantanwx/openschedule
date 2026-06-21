"use client";

import { useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openschedule/ui/components/popover";
import { NotificationList } from "./notification-list";

export function NotificationBell() {
  const unreadCount = useQuery(convexApi.queries.notifications.unreadCount);
  const count = unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
          className="relative rounded-full p-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
