import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("auth guards", () => {
  // Helper to set up common test data
  async function setupOrg(t: ReturnType<typeof convexTest>) {
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "test-org-auth",
        name: "Test Org",
        slug: "test-org",
      });
    });
    return orgId;
  }

  async function setupOwner(
    t: ReturnType<typeof convexTest>,
    orgId: ReturnType<typeof setupOrg> extends Promise<infer T> ? T : never,
  ) {
    const ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "test-owner-auth",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
        orgId,
      });
    });
    return ownerId;
  }

  async function setupTherapist(
    t: ReturnType<typeof convexTest>,
    orgId: ReturnType<typeof setupOrg> extends Promise<infer T> ? T : never,
    suffix = "",
  ) {
    const therapistId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: `test-therapist-auth${suffix}`,
        email: `therapist${suffix}@test.com`,
        name: `Therapist${suffix}`,
        role: "therapist",
        orgId,
      });
    });
    return therapistId;
  }

  test("rejects unauthenticated venue creation", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);

    await expect(
      t.mutation(api.mutations.venues.create, {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  test("owner can create a venue", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    const venueId = await asOwner.mutation(api.mutations.venues.create, {
      orgId,
      name: "Venue",
      slug: "venue",
      timezone: "America/New_York",
      capacity: 3,
      dayStart: "09:00",
      dayEnd: "17:00",
    });

    const venue = await t.query(api.queries.venues.get, { id: venueId });
    expect(venue?.name).toBe("Venue");
    expect(venue?.status).toBe("active");
  });

  test("therapist cannot create a venue", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupTherapist(t, orgId);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.venues.create, {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Insufficient permissions");
  });

  test("owner can archive a venue", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.venues.archive, { id: venueId });

    const venue = await t.query(api.queries.venues.get, { id: venueId });
    expect(venue?.status).toBe("archived");
  });

  test("therapist cannot archive a venue", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupTherapist(t, orgId);

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.venues.archive, { id: venueId }),
    ).rejects.toThrow("Insufficient permissions");
  });

  test("owner can override venue capacity", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);
    const therapist1Id = await setupTherapist(t, orgId, "-1");
    const therapist2Id = await setupTherapist(t, orgId, "-2");

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 1,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "c@test.com",
      name: "Customer",
    });

    // Fill capacity
    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-20",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Owner overrides capacity
    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    const bookingId = await asOwner.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist2Id,
      customerId,
      date: "2025-06-20",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "owner",
      overCapacity: true,
    });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.overCapacity).toBe(true);
  });

  test("therapist cannot override venue capacity", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    const therapist1Id = await setupTherapist(t, orgId, "-1");
    const therapist2Id = await setupTherapist(t, orgId, "-2");

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 1,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "c@test.com",
      name: "Customer",
    });

    // Fill capacity
    await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId: therapist1Id,
      customerId,
      date: "2025-06-20",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    // Therapist tries to override
    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth-2",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth-2",
    });

    await expect(
      asTherapist.mutation(api.mutations.bookings.create, {
        venueId,
        therapistId: therapist2Id,
        customerId,
        date: "2025-06-20",
        startTime: "09:00",
        endTime: "10:00",
        createdBy: "therapist",
        overCapacity: true,
      }),
    ).rejects.toThrow("Only owners can override venue capacity");
  });

  test("cross-org isolation: owner cannot access another org's venue", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);

    // Create a second org
    const otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        authId: "other-org-auth",
        name: "Other Org",
        slug: "other-org",
      });
    });

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await expect(
      asOwner.mutation(api.mutations.venues.create, {
        orgId: otherOrgId,
        name: "Hack Venue",
        slug: "hack",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
      }),
    ).rejects.toThrow("Access denied");
  });

  test("therapist can manage their own schedule", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    const therapistId = await setupTherapist(t, orgId);

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    const scheduleId = await asTherapist.mutation(
      api.mutations.schedules.upsert,
      {
        therapistId,
        venueId,
        workingDays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        slotDuration: 60,
        availabilityHorizonDays: 14,
      },
    );

    expect(scheduleId).toBeDefined();
  });

  test("therapist cannot manage another therapist's schedule", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupTherapist(t, orgId, "-1");
    const therapist2Id = await setupTherapist(t, orgId, "-2");

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    // Therapist 1 tries to manage therapist 2's schedule
    const asTherapist1 = t.withIdentity({
      subject: "test-therapist-auth-1",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth-1",
    });

    await expect(
      asTherapist1.mutation(api.mutations.schedules.upsert, {
        therapistId: therapist2Id,
        venueId,
        workingDays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        slotDuration: 60,
        availabilityHorizonDays: 14,
      }),
    ).rejects.toThrow("Therapists can only manage their own schedule");
  });

  test("venue archival cancels future bookings", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);
    const therapistId = await setupTherapist(t, orgId);

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "c@test.com",
      name: "Customer",
    });

    // Create a future booking
    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2099-12-31",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.venues.archive, { id: venueId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("cancelled");
  });

  test("owner can confirm a booking", async () => {
    const t = convexTest(schema, modules);
    const orgId = await setupOrg(t);
    await setupOwner(t, orgId);
    const therapistId = await setupTherapist(t, orgId);

    const venueId = await t.run(async (ctx) => {
      return await ctx.db.insert("venues", {
        orgId,
        name: "Venue",
        slug: "venue",
        timezone: "America/New_York",
        capacity: 3,
        dayStart: "09:00",
        dayEnd: "17:00",
        status: "active",
      });
    });

    const customerId = await t.mutation(api.mutations.customers.getOrCreate, {
      orgId,
      email: "c@test.com",
      name: "Customer",
    });

    const bookingId = await t.mutation(api.mutations.bookings.create, {
      venueId,
      therapistId,
      customerId,
      date: "2025-06-20",
      startTime: "09:00",
      endTime: "10:00",
      createdBy: "customer",
    });

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.bookings.confirm, { id: bookingId });

    const booking = await t.query(api.queries.bookings.get, { id: bookingId });
    expect(booking?.status).toBe("confirmed");
  });
});
