import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";

export const zodError = (error: ZodError) => {
  let errors: any = {};
  error.issues.map((issue) => {
    const path = issue.path?.[0];
    if (path) errors[path] = issue.message;
  });
  return errors;
};


// Function to parse cookies from Cookie header
export const parseCookies = (cookieHeader: string | undefined): { [key: string]: string } => {
  const cookies: { [key: string]: string } = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [key, value] = cookie.split("=").map((part) => part.trim());
    if (key && value) cookies[key] = value;
  });

  return cookies;
};



type DecimalObj = {s: number; e: number; d: number[]};

export function parseToDecimal(
  price: any,
): number {
  if (price === null || price === undefined || price === "") return 0;
  if (typeof price === "number") return isNaN(price) ? 0 : price;
  if (typeof price === "string") {
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof price === "object") {
    if (typeof price.toNumber === "function") {
      return price.toNumber();
    }
    if (typeof price.toString === "function" && price.toString() !== "[object Object]") {
      const parsed = parseFloat(price.toString());
      if (!isNaN(parsed)) return parsed;
    }
    if ("d" in price && Array.isArray(price.d)) {
      const digits = price.d.join("");
      const exp = typeof price.e === "number" ? price.e : digits.length - 1;
      const sign = price.s === -1 ? -1 : 1;
      const numStr =
        digits.length <= exp + 1
          ? digits.padEnd(exp + 1, "0")
          : `${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
      const parsed = parseFloat(numStr) * sign;
      return isNaN(parsed) ? 0 : parsed;
    }
  }
  const fallback = Number(price);
  return isNaN(fallback) ? 0 : fallback;
}


export const getDateRange = (date?: Date) => {
  if (!date) return undefined;
  const start = new Date(date);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};


export function generateOrderNumber() {
  const dateStr = new Date().toISOString().split("T")[0]?.replace(/-/g, "") ?? "00000000";
  const uniquePart = randomUUID().slice(0, 6).toUpperCase();
  return `ORD-${dateStr}-${uniquePart}`;
}