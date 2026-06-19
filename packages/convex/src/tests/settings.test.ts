import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupOrgWithOwner(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "test-org-auth",
      name: "Test Org",
      slug: "test-org",
    });
    const ownerId = await ctx.db.insert("users", {
      authId: "test-owner-auth",
      email: "owner@test.com",
      name: "Owner",
      roles: ["owner"],
      orgId,
    });
    const therapistId = await ctx.db.insert("users", {
      authId: "test-therapist-auth",
      email: "therapist@test.com",
      name: "Jane",
      roles: ["therapist"],
      orgId,
    });
    return { orgId, ownerId, therapistId };
  });
}

describe("settings queries and mutations", () => {
  test("getByOrg returns null when no settings exist", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const settings = await t.query(api.queries.settings.getByOrg, { orgId });
    expect(settings).toBeNull();
  });

  test("upsert creates settings on first call", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        businessName: "My Clinic",
        contactEmail: "hello@clinic.com",
        contactPhone: null,
        logoStorageId: null,
        emailNotificationsEnabled: false,
      },
    });

    const settings = await t.query(api.queries.settings.getByOrg, { orgId });
    expect(settings).toMatchObject({
      businessName: "My Clinic",
      contactEmail: "hello@clinic.com",
      contactPhone: null,
      logoStorageId: null,
      emailNotificationsEnabled: false,
    });
  });

  test("upsert patches existing settings on subsequent call", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asOwner = t.withIdentity({
      subject: "test-owner-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-owner-auth",
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        businessName: "My Clinic",
        contactEmail: "hello@clinic.com",
        contactPhone: null,
        logoStorageId: null,
        emailNotificationsEnabled: false,
      },
    });

    await asOwner.mutation(api.mutations.settings.upsert, {
      orgId,
      data: {
        emailNotificationsEnabled: true,
        contactPhone: "+1234567890",
      },
    });

    const settings = await t.query(api.queries.settings.getByOrg, { orgId });
    expect(settings).toMatchObject({
      businessName: "My Clinic",
      contactEmail: "hello@clinic.com",
      contactPhone: "+1234567890",
      emailNotificationsEnabled: true,
    });
  });

  test("upsert rejects non-owner", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgWithOwner(t);

    const asTherapist = t.withIdentity({
      subject: "test-therapist-auth",
      issuer: "https://test.com",
      tokenIdentifier: "https://test.com|test-therapist-auth",
    });

    await expect(
      asTherapist.mutation(api.mutations.settings.upsert, {
        orgId,
        data: { businessName: "Hacked" },
      }),
    ).rejects.toThrow("Insufficient permissions");
  });
});
