import { describe, expect, test } from "bun:test";
import { userQuerySchema } from "./user.schema.js";

describe("user query validation", () => {
  test("defaults pagination and sort order", () => {
    const parsed = userQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortBy).toBe("newest");
  });

  test("coerces string numbers for pagination and age bounds", () => {
    const parsed = userQuerySchema.parse({
      page: "2",
      limit: "15",
      minAge: "18",
      maxAge: "35",
      state: "Gujarat",
      city: "Ahmedabad",
      role: "PARTNER",
      gender: "FEMALE",
      search: "Aarohi",
      sortBy: "age_asc",
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(15);
    expect(parsed.minAge).toBe(18);
    expect(parsed.maxAge).toBe(35);
    expect(parsed.state).toBe("Gujarat");
    expect(parsed.city).toBe("Ahmedabad");
    expect(parsed.role).toBe("PARTNER");
    expect(parsed.gender).toBe("FEMALE");
    expect(parsed.search).toBe("Aarohi");
    expect(parsed.sortBy).toBe("age_asc");
  });

  test("rejects invalid role and age bounds", () => {
    expect(() => userQuerySchema.parse({ role: "SUPER_ADMIN" })).toThrow();
    expect(() => userQuerySchema.parse({ minAge: "5" })).toThrow();
    expect(() => userQuerySchema.parse({ maxAge: "150" })).toThrow();
  });
});
