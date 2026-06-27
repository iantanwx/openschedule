import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function setupDirectoryData(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      authId: "org-auth-1",
      name: "Wellness Studio",
      slug: "wellness-studio",
      description: "A great wellness place",
    });
    const orgId2 = await ctx.db.insert("organizations", {
      authId: "org-auth-2",
      name: "Zen Spa",
      slug: "zen-spa",
    });
    const venueId1 = await ctx.db.insert("venues", {
      orgId,
      name: "Downtown Branch",
      slug: "downtown",
      timezone: "America/New_York",
      capacity: 5,
      dayStart: "09:00",
      dayEnd: "17:00",
      address: "123 Main St",
      status: "active",
      description: "Our main location",
    });
    const venueId2 = await ctx.db.insert("venues", {
      orgId: orgId2,
      name: "Zen Retreat",
      slug: "retreat",
      timezone: "America/Los_Angeles",
      capacity: 3,
      dayStart: "10:00",
      dayEnd: "18:00",
      status: "active",
    });
    const archivedVenueId = await ctx.db.insert("venues", {
      orgId,
      name: "Closed Branch",
      slug: "closed",
      timezone: "America/New_York",
      capacity: 2,
      dayStart: "09:00",
      dayEnd: "17:00",
      status: "archived",
    });
    return { orgId, orgId2, venueId1, venueId2, archivedVenueId };
  });
}

describe("directory queries", () => {
  test("listPublicDirectory returns only active venues with org info", async () => {
    const t = convexTest(schema, modules);
    const { venueId1, venueId2, archivedVenueId } = await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.listPublicDirectory, {});

    // Should include the 2 active venues but not the archived one
    expect(results.length).toBe(2);
    const ids = results.map((r: { _id: string }) => r._id);
    expect(ids).toContain(venueId1);
    expect(ids).toContain(venueId2);
    expect(ids).not.toContain(archivedVenueId);

    // Check shape of first result
    const downtown = results.find((r: { _id: string }) => r._id === venueId1);
    expect(downtown).toMatchObject({
      name: "Downtown Branch",
      slug: "downtown",
      address: "123 Main St",
      description: "Our main location",
      org: {
        name: "Wellness Studio",
        slug: "wellness-studio",
        description: "A great wellness place",
      },
    });
  });

  test("searchDirectory filters by venue name (case-insensitive)", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "downtown" });
    expect(results.length).toBe(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe("Downtown Branch");
  });

  test("searchDirectory filters by org name (case-insensitive)", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "zen" });
    expect(results.length).toBe(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe("Zen Retreat");
  });

  test("searchDirectory returns empty array for no matches", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "nonexistent" });
    expect(results.length).toBe(0);
  });

  test("searchDirectory does not return archived venues", async () => {
    const t = convexTest(schema, modules);
    await setupDirectoryData(t);

    const results = await t.query(api.queries.directory.searchDirectory, { query: "closed" });
    expect(results.length).toBe(0);
  });
});
