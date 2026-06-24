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
        description?: string;
      } | null>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
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
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
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
      getBySlugFull: FunctionReference<"query", "public", { orgId: string; slug: string }, {
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
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
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
        serviceId?: string;
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
        serviceId?: string;
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
        serviceId?: string;
      }>>;
      statsByOrg: FunctionReference<"query", "public", { orgId: string; date: string }, {
        total: number;
        confirmed: number;
        pending: number;
        revenue: number;
      }>;
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
        slotDuration?: number;
        availabilityHorizonDays: number;
      }>>;
    };
    ooo: {
      listByTherapist: FunctionReference<"query", "public", { therapistId: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
      listByTherapistAndDateRange: FunctionReference<"query", "public", { therapistId: string; startDate: string; endDate: string }, Array<{
        _id: string;
        _creationTime: number;
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
        status: "active" | "inactive";
      }>>;
    };
    users: {
      getPublic: FunctionReference<"query", "public", { id: string }, { _id: string; name: string } | null>;
      listByVenue: FunctionReference<"query", "public", { venueId: string }, Array<{ _id: string; name: string }>>;
      listTherapistsByOrg: FunctionReference<"query", "public", { orgId: string }, Array<{ _id: string; name: string }>>;
      getSelf: FunctionReference<"query", "public", Record<string, never>, {
        _id: string;
        name: string;
        email: string;
        roles: Array<"owner" | "therapist">;
        active: boolean;
        orgId: string | null;
      } | null>;
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
      getSlots: FunctionReference<"query", "public", { venueId: string; therapistId: string; serviceId: string }, Record<string, Array<{ startTime: string; endTime: string }>>>;
    };
    services: {
      listByOrg: FunctionReference<"query", "public", { orgId: string }, Array<{
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        description: string;
        duration: number;
        price: number;
        color: string;
        status: "active" | "archived";
      }>>;
      listAllByOrg: FunctionReference<"query", "public", { orgId: string }, Array<{
        _id: string;
        _creationTime: number;
        orgId: string;
        name: string;
        slug: string;
        description: string;
        duration: number;
        price: number;
        color: string;
        status: "active" | "archived";
      }>>;
      getBySlug: FunctionReference<"query", "public", { orgId: string; slug: string }, {
        _id: string;
        orgId: string;
        name: string;
        slug: string;
        description: string;
        duration: number;
        price: number;
        color: string;
        status: "active" | "archived";
      } | null>;
      get: FunctionReference<"query", "public", { id: string }, {
        _id: string;
        name: string;
        duration: number;
      } | null>;
    };
    therapistServices: {
      listByTherapist: FunctionReference<"query", "public", { therapistId: string }, Array<{
        _id: string;
        orgId: string;
        name: string;
        slug: string;
        description: string;
        duration: number;
        price: number;
        color: string;
        status: "active" | "archived";
      }>>;
      listTherapistsByService: FunctionReference<"query", "public", { serviceId: string; venueId: string }, Array<{
        _id: string;
        name: string;
      }>>;
    };
    settings: {
      getByOrg: FunctionReference<"query", "public", { orgId: string }, {
        businessName: string;
        contactEmail: string | null;
        contactPhone: string | null;
        logoStorageId: string | null;
        emailNotificationsEnabled: boolean;
      } | null>;
    };
    integrations: {
      getByCurrentUser: FunctionReference<"query", "public", Record<string, never>, {
        _id: string;
        provider: string;
        enabled: boolean;
        connectedAt: number;
      } | null>;
    };
    notifications: {
      listRecent: FunctionReference<"query", "public", { limit?: number }, Array<{
        _id: string;
        _creationTime: number;
        recipientId: string;
        type: "booking_created" | "booking_cancelled" | "booking_rescheduled" | "therapist_joined";
        orgId: string;
        payload: Record<string, unknown>;
        read: boolean;
        createdAt: number;
      }>>;
      unreadCount: FunctionReference<"query", "public", Record<string, never>, number>;
      listOrgActivity: FunctionReference<"query", "public", { orgId: string; limit?: number }, Array<{
        _id: string;
        _creationTime: number;
        recipientId: string;
        type: "booking_created" | "booking_cancelled" | "booking_rescheduled" | "therapist_joined";
        orgId: string;
        payload: Record<string, unknown>;
        read: boolean;
        createdAt: number;
      }>>;
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
      create: FunctionReference<"mutation", "public", {
        orgId: string;
        name: string;
        slug: string;
        timezone: string;
        capacity: number;
        dayStart: string;
        dayEnd: string;
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        timezone?: string;
        capacity?: number;
        dayStart?: string;
        dayEnd?: string;
        address?: string;
        coordinates?: { lat: number; lng: number };
        placeId?: string;
        description?: string;
        coverImageId?: string;
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
        slotDuration?: number;
        availabilityHorizonDays: number;
      }, string>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    users: {
      setActive: FunctionReference<"mutation", "public", { userId: string; active: boolean }, null>;
      toggleTherapistRole: FunctionReference<"mutation", "public", Record<string, never>, null>;
    };
    ooo: {
      create: FunctionReference<"mutation", "public", {
        therapistId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        reason?: string;
      }, string>;
      update: FunctionReference<"mutation", "public", {
        id: string;
        startDate?: string;
        startTime?: string;
        endDate?: string;
        endTime?: string;
        reason?: string;
      }, void>;
      remove: FunctionReference<"mutation", "public", { id: string }, void>;
      activate: FunctionReference<"mutation", "public", { id: string }, void>;
    };
    services: {
      create: FunctionReference<"mutation">;
      update: FunctionReference<"mutation">;
      archive: FunctionReference<"mutation">;
      unarchive: FunctionReference<"mutation">;
    };
    therapistServices: {
      assign: FunctionReference<"mutation">;
      remove: FunctionReference<"mutation">;
    };
    settings: {
      upsert: FunctionReference<"mutation", "public", {
        orgId: string;
        data: {
          businessName: string;
          contactEmail: string | null;
          contactPhone: string | null;
          logoStorageId: string | null;
          emailNotificationsEnabled: boolean;
        };
      }, void>;
    };
    integrations: {
      upsert: FunctionReference<"mutation", "public", {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }, string>;
      disconnect: FunctionReference<"mutation", "public", Record<string, never>, void>;
    };
    notifications: {
      markRead: FunctionReference<"mutation", "public", { id: string }, void>;
      markAllRead: FunctionReference<"mutation", "public", Record<string, never>, void>;
    };
    generateUploadUrl: {
      generateUploadUrl: FunctionReference<"mutation", "public", Record<string, never>, string>;
    };
    organizations: {
      update: FunctionReference<"mutation", "public", {
        id: string;
        name?: string;
        slug?: string;
        description?: string;
      }, void>;
    };
  };
};
