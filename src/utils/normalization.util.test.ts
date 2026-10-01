import { describe, expect, test } from "bun:test";
import { normalizeEmail, normalizePhone, parsePage } from "./normalization.util.js";

describe("identity normalization", () => {
  test("normalizes email and E.164 phone", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });

  test("rejects an invalid phone format", () => {
    expect(() => normalizePhone("123")).toThrow("valid phone");
  });

  test("always produces bounded integer pagination", () => {
    expect(parsePage("1.5", "500")).toEqual({ page: 1, limit: 100, skip: 0 });
  });
});
