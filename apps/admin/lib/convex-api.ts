// apps/admin/lib/convex-api.ts
import type { FunctionReference } from "convex/server";
import { api } from "@openschedule/convex/api";

/**
 * Typed Convex API map for the admin app.
 * FunctionReference cast required because FilterApi doesn't resolve across
 * package boundaries in this monorepo setup.
 */
export const convexApi = api as unknown as {
  queries: {
    organizations: {
      getBySlug: FunctionReference<"query", "public", { slug: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
      } | null>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
      } | null>;
    };
    venues: {
      listByOrg: FunctionReference<"query", "public", { orgId: string }, Array<{
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        status: "active" | "archived";
      }>>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        status: "active" | "archived";
      } | null>;
    };
    bookings: {
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      } | null>;
      listByVenueAndDate: FunctionReference<"query", "public", { venueId: string; date: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
      listByVenueDateRange: FunctionReference<"query", "public", { venueId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
      listByTherapistAndDateRange: FunctionReference<"query", "public", { therapistId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        status: "pending" | "confirmed" | "cancelled";
        createdBy: "customer" | "therapist" | "owner";
        overCapacity: boolean;
      }>>;
    };
    schedules: {
      listByVenue: FunctionReference<"query", "public", { venueId: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        venueId: string;
        workingDays: number[];
        startTime: string;
        endTime: string;
        slotDuration: number;
        availabilityHorizonDays: number;
      }>>;
    };
    users: {
      getPublic: FunctionReference<"query", "public", { id: string }, { _id: string; name: string } | null>;
      listByVenue: FunctionReference<"query", "public", { venueId: string }, Array<{ _id: string; name: string }>>;
    };
    customers: {
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        orgId: string;
        email: string;
        name: string;
        phone?: string;
      } | null>;
    };
    availability: {
      getSlots: FunctionReference<"query", "public", { venueId: string; therapistId: string }, Record<string, Array<{ startTime: string; endTime: string }>>>;
    };
  };
  mutations: {
    bookings: {
      create: FunctionReference<"mutation", "public", {
        venueId: string;
        therapistId: string;
        customerId: string;
        date: string;
        startTime: string;
        endTime: string;
        createdBy: "customer" | "therapist" | "owner";
        overCapacity?: boolean;
      }, string>;
      confirm: FunctionReference<"mutation", "public", { id: string }, void>;
      cancel: FunctionReference<"mutation", "public", { id: string }, void>;
      reschedule: FunctionReference<"mutation", "public", {
        id: string;
        newDate: string;
        newStartTime: string;
        newEndTime: string;
      }, void>;
    };
    customers: {
      getOrCreate: FunctionReference<"mutation", "public", {
        orgId: string;
        email: string;
        name: string;
        phone?: string;
      }, string>;
    };
    venues: {
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        timezone?: string;
        capacity?: number;
        dayStart?: string;
        dayEnd?: string;
      }, void>;
      archive: FunctionReference<"mutation", "public", { id: string }, void>;
      unarchive: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    schedules: {
      upsert: FunctionReference<"mutation", "public", {
        therapistId: string;
        venueId: string;
        workingDays: number[];
        startTime: string;
        endTime: string;
        slotDuration: number;
        availabilityHorizonDays: number;
      }, string>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
    };
  };
};
