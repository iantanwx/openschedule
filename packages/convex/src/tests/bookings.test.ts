import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("booking mutations", () => {
  test("creates a pending booking", async () => {
    const t = convexTest(schema, modules);

    // Insert org and venue directly (venues.create is now auth-guarded)
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking).toMatchObject({
      status: "pending",
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      overCapacity: false,
    });
  });

  test("prevents double-booking a therapist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await expect(
      t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId,
        customerId,
        date: "2025-06-16",
        startTime: "09:30",
        endTime: "10:30",
        createdBy: "customer",
      }),
    ).rejects.toThrow("Therapist already has a booking at this time");
  });

  test("prevents booking when venue at capacity", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
        capacity: 1,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const therapist1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-1",
        email: "t1@test.com",
        name: "Therapist 1",
        roles: ["therapist"],
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-2",
        email: "t2@test.com",
        name: "Therapist 2",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    // First booking takes the only bed
    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Second booking at same time should fail (venue at capacity)
    await expect(
      t.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: therapist2Id,
        customerId,
        date: "2025-06-16",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "customer",
      }),
    ).rejects.toThrow("Venue is at capacity for this time slot");
  });

  test("allows over-capacity booking with owner auth", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
        capacity: 1,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    // Create an owner user for auth
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        roles: ["owner"],
        orgId,
      });
    });

    const therapist1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-1",
        email: "t1@test.com",
        name: "Therapist 1",
        roles: ["therapist"],
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-2",
        email: "t2@test.com",
        name: "Therapist 2",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Owner forces over-capacity (requires owner identity)
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    const bookingId = await asOwner.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist2Id,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "owner",
      overCapacity: true,
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.overCapacity).toBe(true);
  });

  test("confirms a pending booking (requires auth)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Confirm requires authenticated therapist/owner
    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.bookings.confirm, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("confirmed");
  });

  test("cancel requires an authenticated owner or therapist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Unauthenticated cancel must be rejected (security gap closed)
    await expect(
      t.mutation(api.mutations.bookings.cancel, { id: bookingId }),
    ).rejects.toThrow();

    // Status unchanged
    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("pending");
  });

  test("cancels a booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Cancel now requires an authenticated owner/therapist
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        roles: ["owner"],
        orgId,
      });
    });
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });

  test("reschedules a booking to a new time slot", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Reschedule requires owner/therapist auth
    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.bookings.reschedule, {
      id: bookingId,
      newDate: "2025-06-17",
      newStartTime: "10:00",
      newEndTime: "11:00",
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.date).toBe("2025-06-17");
    expect(booking?.startTime).toBe("10:00");
    expect(booking?.endTime).toBe("11:00");
    expect(booking?.status).toBe("pending");
  });

  test("prevents rescheduling to a conflicting time slot", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    // Booking A: 09:00-10:00
    const bookingAId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Booking B: 11:00-12:00
    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "11:00",
      endTime: "12:00",
      createdBy: "customer",
    });

    // Try to reschedule A to overlap B
    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.bookings.reschedule, {
        id: bookingAId,
        newDate: "2025-06-16",
        newStartTime: "11:00",
        newEndTime: "12:00",
      }),
    ).rejects.toThrow("Therapist already has a booking at this time");
  });

  test("prevents rescheduling a cancelled booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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

    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        roles: ["owner"],
        orgId,
      });
    });
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.bookings.reschedule, {
        id: bookingId,
        newDate: "2025-06-17",
        newStartTime: "10:00",
        newEndTime: "11:00",
      }),
    ).rejects.toThrow("Cannot reschedule a cancelled booking");
  });

  test("create stores a cancelToken on the booking", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const token = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId);
      if (b && "cancelToken" in b) {
        return b.cancelToken;
      }
      return undefined;
    });
    expect(typeof token).toBe("string");
    expect((token as string | undefined)?.length).toBeGreaterThan(0);
  });

  test("cancelWithToken cancels a booking with a valid token", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Seed a known token directly so this test is independent of the create-time
    // token wiring (which lands in Task 5). Task 5 adds its own create-token test.
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "test-cancel-token" });
    });

    await t.mutation(api.mutations.bookings.cancelWithToken, {
      id: bookingId,
      cancelToken: "test-cancel-token",
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });

  test("cancelWithToken rejects a wrong token and leaves status unchanged", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "real-token" });
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "definitely-not-the-token",
      }),
    ).rejects.toThrow("Invalid or missing cancel token");

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("pending");
  });

  test("cancelWithToken on an already-cancelled booking throws", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { cancelToken: "test-cancel-token" });
    });
    await t.mutation(api.mutations.bookings.cancelWithToken, {
      id: bookingId,
      cancelToken: "test-cancel-token",
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "test-cancel-token",
      }),
    ).rejects.toThrow("Booking is already cancelled");
  });

  test("cancelWithToken throws when the booking does not exist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-16",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Remove it, then try to cancel the now-missing id
    await t.run(async (ctx) => {
      await ctx.db.delete(bookingId);
    });

    await expect(
      t.mutation(api.mutations.bookings.cancelWithToken, {
        id: bookingId,
        cancelToken: "any",
      }),
    ).rejects.toThrow("Booking not found");
  });

  test("stores serviceId on booking when provided", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
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
    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        orgId,
        name: "Deep Tissue",
        slug: "deep-tissue",
        description: "90 min massage",
        duration: 90,
        price: 15000,
        color: "#4f46e5",
        status: "active",
      });
    });
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth",
        email: "therapist@test.com",
        name: "Jane",
        roles: ["therapist"],
        orgId,
      });
    });
    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "customer@test.com",
      name: "John",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-07-01",
      startTime: "09:00",
      endTime: "10:30",
      createdBy: "customer",
      serviceId,
    });

    const booking = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId);
      if (b && "serviceId" in b) return b.serviceId;
      return undefined;
    });
    expect(booking).toBe(serviceId);
  });
});
