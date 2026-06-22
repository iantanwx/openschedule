"use client";

import { useState, useMemo } from "react";

interface ViewScopeBooking {
  therapistId: string;
}

interface UseViewScopeOptions<T extends ViewScopeBooking> {
  currentUser: { _id: string; roles: string[] } | null | undefined;
  bookings: T[] | undefined;
}

interface UseViewScopeResult<T extends ViewScopeBooking> {
  viewScope: "my" | "all";
  setViewScope: (scope: "my" | "all") => void;
  /** Owner sees toggle; pure therapist does not */
  showToggle: boolean;
  /** Owner in "All" mode sees the therapist dropdown */
  showTherapistFilter: boolean;
  /** Pure therapist is always read-only; owner is never read-only */
  isReadOnly: boolean;
  /** Bookings filtered by current scope */
  filteredByScope: T[];
}

/**
 * Shared view-scope logic for Today and Bookings pages.
 *
 * Rules:
 * - Owner: sees My/All toggle. "My" filters to own. "All" shows everyone + therapist dropdown.
 * - Pure therapist (no owner role): no toggle, always filtered to own bookings, read-only.
 */
export function useViewScope<T extends ViewScopeBooking>({ currentUser, bookings }: UseViewScopeOptions<T>): UseViewScopeResult<T> {
  const [viewScope, setViewScope] = useState<"my" | "all">("my");

  const isOwner = currentUser?.roles.includes("owner") ?? false;

  const showToggle = isOwner;
  const showTherapistFilter = isOwner && viewScope === "all";
  const isReadOnly = !isOwner;

  const filteredByScope = useMemo((): T[] => {
    if (!bookings) return [];
    if (!currentUser) return [];

    if (isOwner) {
      // Owner in "All" sees everything; "My" filters to own
      if (viewScope === "all") return bookings;
      return bookings.filter((b) => b.therapistId === currentUser._id);
    }

    // Pure therapist: always own bookings only
    return bookings.filter((b) => b.therapistId === currentUser._id);
  }, [bookings, currentUser, isOwner, viewScope]);

  return {
    viewScope,
    setViewScope,
    showToggle,
    showTherapistFilter,
    isReadOnly,
    filteredByScope,
  };
}
