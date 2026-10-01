import { describe, expect, test } from "bun:test";
import { eventListQuerySchema, registrationListQuerySchema, reviewRegistrationSchema } from "./admin.schema.js";

describe("super admin request validation", () => {
  test("accepts only public registration roles", () => {
    expect(registrationListQuerySchema.parse({ role: "PARTNER" }).role).toBe("PARTNER");
    expect(registrationListQuerySchema.parse({ role: "ORGANIZER", status: "PENDING" }).status).toBe("PENDING");
    expect(() => registrationListQuerySchema.parse({ role: "SUPER_ADMIN" })).toThrow();
  });

  test("bounds pagination and filters", () => {
    expect(() => registrationListQuerySchema.parse({ limit: 101 })).toThrow();
    expect(eventListQuerySchema.parse({ page: "2", limit: "12" })).toMatchObject({ page: 2, limit: 12 });
  });

  test("requires a rejection reason", () => {
    expect(() => reviewRegistrationSchema.parse({ decision: "REJECT", reason: "" })).toThrow();
  });
});
