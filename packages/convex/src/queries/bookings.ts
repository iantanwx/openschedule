import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../lib/auth";
import type { Booking } from "../types/bookings.queries";

export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args): Promise<Booking | null> => {
    const booking = await ctx.db.get(args.id);
    if (!booking) return null;
    return {
      _id: booking._id,
      _creationTime: booking._creationTime,
      venueId: booking.venueId,
      therapistId: booking.therapistId,
      customerId: booking.customerId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      createdBy: booking.createdBy,
      overCapacity: booking.overCapacity,
      serviceId: booking.serviceId,
    };
  },
});

export const listByVenueAndDate = query({
  args: { venueId: v.id("venues"), date: v.string() },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q.eq("venueId", args.venueId).eq("date", args.date),
      )
      .take(200);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }),
    );
  },
});

export const listByTherapistAndDateRange = query({
  args: {
    therapistId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_therapistId_and_date", (q) =>
        q
          .eq("therapistId", args.therapistId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }),
    );
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(50);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }),
    );
  },
});

export const listByVenueDateRange = query({
  args: {
    venueId: v.id("venues"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args): Promise<Booking[]> => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_venueId_and_date", (q) =>
        q
          .eq("venueId", args.venueId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .take(500);
    return bookings.map(
      ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }) => ({
        _id,
        _creationTime,
        venueId,
        therapistId,
        customerId,
        date,
        startTime,
        endTime,
        status,
        createdBy,
        overCapacity,
        serviceId,
      }),
    );
  },
});

export const statsByOrg = query({
  args: { orgId: v.id("organizations"), date: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const isOwner = user.roles.includes("owner");

    // Get all venues for this org
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(20);

    let allBookings: Array<{ status: string; serviceId?: string }> = [];

    for (const venue of venues) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_venueId_and_date", (q) =>
          q.eq("venueId", venue._id).eq("date", args.date),
        )
        .take(200);

      const filtered = isOwner
        ? bookings
        : bookings.filter((b) => b.therapistId === user._id);

      for (const b of filtered) {
        allBookings.push({ status: b.status, serviceId: b.serviceId as string | undefined });
      }
    }

    const nonCancelled = allBookings.filter((b) => b.status !== "cancelled");
    const confirmed = nonCancelled.filter((b) => b.status === "confirmed");
    const pending = nonCancelled.filter((b) => b.status === "pending");

    // Resolve revenue from confirmed bookings with serviceId
    let revenue = 0;
    const serviceIds = [...new Set(confirmed.filter((b) => b.serviceId).map((b) => b.serviceId))];
    const serviceMap = new Map<string, number>();
    for (const sid of serviceIds) {
      if (!sid) continue;
      const service = await ctx.db.get(sid as any);
      if (service && "price" in service) {
        serviceMap.set(sid, (service as any).price ?? 0);
      }
    }
    for (const b of confirmed) {
      if (b.serviceId) {
        revenue += serviceMap.get(b.serviceId) ?? 0;
      }
    }

    return {
      total: nonCancelled.length,
      confirmed: confirmed.length,
      pending: pending.length,
      revenue,
    };
  },
});
