"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useActiveOrganization, useSession, signOut } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Avatar, AvatarFallback } from "@opencal/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@opencal/ui/components/dropdown-menu";
import { ArrowLeft, ChevronDown, Settings, LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@opencal/ui/lib/utils";
import { NotificationBell } from "./notification-bell";

interface MobileTopBarProps {
  mode: "org" | "venue";
  className?: string;
}

export function MobileTopBar({ mode, className }: MobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const params = useParams<{ orgSlug: string; venueSlug: string }>();
  const orgSlug = params.orgSlug;
  const venueSlug = params.venueSlug;

  const { data: activeOrg } = useActiveOrganization();
  const { data: session } = useSession();

  const org = useQuery(
    convexApi.queries.organizations.getBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );

  const venue = useQuery(
    convexApi.queries.venues.getBySlugFull,
    org && venueSlug ? { orgId: org._id, slug: venueSlug } : "skip",
  );

  const venues = useQuery(
    convexApi.queries.venues.listByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const orgName = activeOrg?.name ?? org?.name ?? "Organization";
  const orgInitial = orgName[0]?.toUpperCase() ?? "O";

  const userName = session?.user?.name ?? "U";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  function handleVenueSwitch(targetSlug: string) {
    const newPath = pathname.replace(
      `/${orgSlug}/venues/${venueSlug}`,
      `/${orgSlug}/venues/${targetSlug}`,
    );
    router.push(newPath);
  }

  const avatarDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="User menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Account Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (mode === "org") {
    return (
      <header className={cn("flex h-14 items-center border-b px-4", className)}>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            {orgInitial}
          </span>
          <span className="text-sm font-semibold">{orgName}</span>
        </div>
        <div className="flex flex-1 justify-end">
          <div className="flex items-center gap-1">
            <NotificationBell />
            {avatarDropdown}
          </div>
        </div>
      </header>
    );
  }

  // mode === "venue"
  const venueName = venue?.name ?? "Venue";
  const showVenueDropdown = venues && venues.length >= 2;

  return (
    <header className={cn("flex h-14 items-center border-b px-4", className)}>
      <div className="flex flex-1 items-center gap-2">
        <Link href={`/${orgSlug}`} className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5" />
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
            {orgInitial}
          </span>
        </Link>
      </div>
      <div className="flex items-center">
        {showVenueDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-semibold hover:text-foreground/80">
              {venueName}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {venues.map((v) => (
                <DropdownMenuItem
                  key={v._id}
                  onClick={() => handleVenueSwitch(v.slug)}
                  className={v.slug === venueSlug ? "font-semibold" : ""}
                >
                  {v.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-semibold">{venueName}</span>
        )}
      </div>
      <div className="flex flex-1 justify-end">
        <div className="flex items-center gap-1">
          <NotificationBell />
          {avatarDropdown}
        </div>
      </div>
    </header>
  );
}
