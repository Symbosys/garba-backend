import { describe, expect, test } from "bun:test";
import { registrationSchema } from "./auth.schema.js";

const valid = { role: "PARTNER", name: "Test User", age: 22, email: "test@example.com", phone: "+919876543210", password: "StrongPass1", addressLine: "1 Main Road", city: "Ahmedabad", state: "Gujarat", gender: "OTHER" };

describe("registration validation", () => {
  test("accepts partner and organizer roles with valid age", () => {
    expect(registrationSchema.parse(valid).role).toBe("PARTNER");
    expect(registrationSchema.parse(valid).age).toBe(22);
    expect(registrationSchema.parse({ ...valid, role: "ORGANIZER" }).role).toBe("ORGANIZER");
  });

  test("rejects invalid age below 14 or above 100", () => {
    expect(() => registrationSchema.parse({ ...valid, age: 10 })).toThrow();
    expect(() => registrationSchema.parse({ ...valid, age: 105 })).toThrow();
  });

  test("never permits privileged or non-public registration", () => {
    expect(() => registrationSchema.parse({ ...valid, role: "SUPER_ADMIN" })).toThrow();
    expect(() => registrationSchema.parse({ ...valid, role: "ADMIN" })).toThrow();
  });
});
