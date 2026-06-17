import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupOrg(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "test-org-auth",
      name: "Test Org",
      slug: "test-org",
    });
    const therapistId = await ctx.db.insert("users", {
      authId: "test-therapist-auth",
      email: "therapist@test.com",
      name: "Jane",
      role: "therapist",
      orgId,
    });
    return { orgId, therapistId };
  });
}

describe("blockout mutations", () => {
  test("remove sets status to inactive (soft-delete)", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    const blockoutId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Training",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: blockoutId });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(blockoutId);
    });
    if (!doc || !("status" in doc)) {
      throw new Error("Expected blockout document with status field");
    }
    expect(doc.status).toBe("inactive");
  });

  test("activate restores an inactive blockout to active", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    const blockoutId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: blockoutId });
    await asTherapist.mutation(api.mutations.blockouts.activate, { id: blockoutId });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(blockoutId);
    });
    if (!doc || !("status" in doc)) {
      throw new Error("Expected blockout document with status field");
    }
    expect(doc.status).toBe("active");
  });

  test("listByTherapist returns only active blockouts", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-01",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Active one",
    });

    const inactiveId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-02",
      startTime: "10:00",
      endTime: "12:00",
      reason: "Will be removed",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: inactiveId });

    const results = await t.query(api.queries.blockouts.listByTherapist, { therapistId });
    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe("Active one");
  });

  test("listByTherapistAndDateRange returns only active blockouts", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-05",
      startTime: "09:00",
      endTime: "11:00",
    });

    const inactiveId = await asTherapist.mutation(api.mutations.blockouts.create, {
      therapistId,
      date: "2099-12-06",
      startTime: "09:00",
      endTime: "11:00",
    });

    await asTherapist.mutation(api.mutations.blockouts.remove, { id: inactiveId });

    const results = await t.query(api.queries.blockouts.listByTherapistAndDateRange, {
      therapistId,
      startDate: "2099-12-01",
      endDate: "2099-12-31",
    });
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe("2099-12-05");
  });

  test("cannot create blockout with startTime >= endTime", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.blockouts.create, {
        therapistId,
        date: "2099-12-01",
        startTime: "14:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow("Start time must be before end time");
  });

  test("cannot create blockout in the past", async () => {
    const t = convexTest(schema, modules);
    const { therapistId } = await setupOrg(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.blockouts.create, {
        therapistId,
        date: "2020-01-01",
        startTime: "10:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow("Cannot create a blockout in the past");
  });
});
