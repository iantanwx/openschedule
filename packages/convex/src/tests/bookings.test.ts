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
        role: "therapist",
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
        role: "therapist",
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
        role: "therapist",
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-2",
        email: "t2@test.com",
        name: "Therapist 2",
        role: "therapist",
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
        role: "owner",
        orgId,
      });
    });

    const therapist1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-1",
        email: "t1@test.com",
        name: "Therapist 1",
        role: "therapist",
        orgId,
      });
    });
    const therapist2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-therapist-auth-2",
        email: "t2@test.com",
        name: "Therapist 2",
        role: "therapist",
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
        role: "therapist",
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
        role: "therapist",
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

    // Cancel is still public (customers can cancel)
    await t.mutation(api.mutations.bookings.cancel, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });
});
