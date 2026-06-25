import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/**
 * Notification invariants:
 * 1. ALWAYS NOTIFY — every relevant person gets a notification, even if they performed the action
 * 2. NEVER DUPLICATE — a user who is both therapist AND owner gets exactly one notification per event
 */
describe("notification invariants", () => {
  // Helper to set up a standard org with an owner, therapist, venue, and customer
  async function setupOrg(t: ReturnType<typeof convexTest>) {
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "org-auth-id",
        name: "Test Org",
        slug: "test-org",
      });
    });

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "owner-auth",
        email: "owner@test.com",
        name: "Owner",
        roles: ["owner"],
        orgId,
      });
    });

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "therapist-auth",
        email: "therapist@test.com",
        name: "Therapist",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "Customer",
    });

    return { orgId, venueId, ownerId, therapistId, customerId };
  }

  // Helper to set up an org where the owner is also the therapist
  async function setupOwnerTherapistOrg(t: ReturnType<typeof convexTest>) {
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "org-auth-id",
        name: "Test Org",
        slug: "test-org",
      });
    });

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Test Venue",
        slug: "test-venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    // Single user who is both owner and therapist
    const ownerTherapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "owner-therapist-auth",
        email: "owner@test.com",
        name: "Owner-Therapist",
        roles: ["owner", "therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "Customer",
    });

    return { orgId, venueId, ownerTherapistId, customerId };
  }

  // Helper to count notifications for a user
  async function getNotifications(t: ReturnType<typeof convexTest>, recipientId: string) {
    return await t.run(async (ctx) => {
      const all = await ctx.db
        .query("notifications")
        .withIndex("by_recipientId_and_createdAt", (q) => q.eq("recipientId", recipientId as any))
        .collect();
      return all;
    });
  }

  describe("booking_created", () => {
    test("customer books → therapist gets 1 notification, owner gets 1 notification", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerId, therapistId, customerId } = await setupOrg(t);

      await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      const therapistNotifs = await getNotifications(t, therapistId);
      const ownerNotifs = await getNotifications(t, ownerId);

      expect(therapistNotifs).toHaveLength(1);
      expect(therapistNotifs[0].type).toBe("booking_created");
      expect(ownerNotifs).toHaveLength(1);
      expect(ownerNotifs[0].type).toBe("booking_created");
    });

    test("customer books owner-therapist → exactly 1 notification (no duplicate)", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerTherapistId, customerId } = await setupOwnerTherapistOrg(t);

      await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: ownerTherapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      const notifs = await getNotifications(t, ownerTherapistId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("booking_created");
    });

    test("owner creates booking for themselves → still gets 1 notification", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerTherapistId, customerId } = await setupOwnerTherapistOrg(t);

      const asOwner = t.withIdentity({
        subject: "owner-therapist-auth",
        issuer: "https://test.com",
        tokenIdentifier: "https://test.com|owner-therapist-auth",
      });

      await asOwner.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: ownerTherapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "owner",
      });

      const notifs = await getNotifications(t, ownerTherapistId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("booking_created");
    });

    test("org with 2 owners + separate therapist → therapist gets 1, each owner gets 1", async () => {
      const t = convexTest(schema, modules);
      const { orgId, venueId, ownerId, therapistId, customerId } = await setupOrg(t);

      // Add a second owner
      const owner2Id = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          authId: "owner2-auth",
          email: "owner2@test.com",
          name: "Owner 2",
          roles: ["owner"],
          orgId,
        });
      });

      await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      const therapistNotifs = await getNotifications(t, therapistId);
      const owner1Notifs = await getNotifications(t, ownerId);
      const owner2Notifs = await getNotifications(t, owner2Id);

      expect(therapistNotifs).toHaveLength(1);
      expect(owner1Notifs).toHaveLength(1);
      expect(owner2Notifs).toHaveLength(1);
    });
  });

  describe("booking_cancelled (auth — admin cancel)", () => {
    test("owner cancels booking → therapist gets 1, owner gets 1 (self-notify)", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerId, therapistId, customerId } = await setupOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      const asOwner = t.withIdentity({
        subject: "owner-auth",
        issuer: "https://test.com",
        tokenIdentifier: "https://test.com|owner-auth",
      });

      await asOwner.mutation(api.mutations.bookings.cancel, { id: bookingId });

      const therapistNotifs = await getNotifications(t, therapistId);
      const ownerNotifs = await getNotifications(t, ownerId);

      expect(therapistNotifs).toHaveLength(1);
      expect(therapistNotifs[0].type).toBe("booking_cancelled");
      expect(ownerNotifs).toHaveLength(1);
      expect(ownerNotifs[0].type).toBe("booking_cancelled");
    });

    test("owner-therapist cancels own booking → exactly 1 notification (no duplicate)", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerTherapistId, customerId } = await setupOwnerTherapistOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: ownerTherapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      const asOwnerTherapist = t.withIdentity({
        subject: "owner-therapist-auth",
        issuer: "https://test.com",
        tokenIdentifier: "https://test.com|owner-therapist-auth",
      });

      await asOwnerTherapist.mutation(api.mutations.bookings.cancel, { id: bookingId });

      const notifs = await getNotifications(t, ownerTherapistId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("booking_cancelled");
    });
  });

  describe("booking_cancelled (token — customer cancel)", () => {
    test("customer cancels → therapist gets 1, owner gets 1", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerId, therapistId, customerId } = await setupOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      // Seed a cancel token
      const cancelToken = await t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId);
        return booking?.cancelToken as string;
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      await t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken,
      });

      const therapistNotifs = await getNotifications(t, therapistId);
      const ownerNotifs = await getNotifications(t, ownerId);

      expect(therapistNotifs).toHaveLength(1);
      expect(therapistNotifs[0].type).toBe("booking_cancelled");
      expect(ownerNotifs).toHaveLength(1);
      expect(ownerNotifs[0].type).toBe("booking_cancelled");
    });

    test("customer cancels booking with owner-therapist → exactly 1 notification", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerTherapistId, customerId } = await setupOwnerTherapistOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: ownerTherapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      const cancelToken = await t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId);
        return booking?.cancelToken as string;
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      await t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken,
      });

      const notifs = await getNotifications(t, ownerTherapistId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("booking_cancelled");
    });
  });

  describe("booking_rescheduled", () => {
    test("owner reschedules → therapist gets 1, owner gets 1 (self-notify)", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerId, therapistId, customerId } = await setupOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      const asOwner = t.withIdentity({
        subject: "owner-auth",
        issuer: "https://test.com",
        tokenIdentifier: "https://test.com|owner-auth",
      });

      await asOwner.mutation(api.mutations.bookings.reschedule, {
        id: bookingId,
        newDate: "2025-07-02",
        newStartTime: "10:00",
        newEndTime: "11:00",
      });

      const therapistNotifs = await getNotifications(t, therapistId);
      const ownerNotifs = await getNotifications(t, ownerId);

      expect(therapistNotifs).toHaveLength(1);
      expect(therapistNotifs[0].type).toBe("booking_rescheduled");
      expect(ownerNotifs).toHaveLength(1);
      expect(ownerNotifs[0].type).toBe("booking_rescheduled");
    });

    test("owner-therapist reschedules own booking → exactly 1 notification", async () => {
      const t = convexTest(schema, modules);
      const { venueId, ownerTherapistId, customerId } = await setupOwnerTherapistOrg(t);

      const bookingId = await t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: ownerTherapistId,
        customerId,
        date: "2025-07-01",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      });

      // Clear create notifications
      await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          await ctx.db.delete(n._id);
        }
      });

      const asOwnerTherapist = t.withIdentity({
        subject: "owner-therapist-auth",
        issuer: "https://test.com",
        tokenIdentifier: "https://test.com|owner-therapist-auth",
      });

      await asOwnerTherapist.mutation(api.mutations.bookings.reschedule, {
        id: bookingId,
        newDate: "2025-07-02",
        newStartTime: "10:00",
        newEndTime: "11:00",
      });

      const notifs = await getNotifications(t, ownerTherapistId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("booking_rescheduled");
    });
  });
});
