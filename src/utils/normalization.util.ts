import { statusCode } from "../types/types.js";
import { ErrorResponse } from "./response.util.js";

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function normalizePhone(value: string): string {
  const cleaned = value.trim().replace(/[\s()-]/g, "");
  if (!cleaned) throw new ErrorResponse("Phone number is required", statusCode.Bad_Request);

  if (cleaned.startsWith("+")) {
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      throw new ErrorResponse("Please enter a valid phone number", statusCode.Bad_Request);
    }
    return cleaned;
  }

  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  if (/^0\d{10}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  if (/^\d{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  throw new ErrorResponse("Please enter a valid phone number", statusCode.Bad_Request);
}

export const parsePage = (pageValue: unknown, limitValue: unknown, max = 100) => {
  const page = Math.max(1, Math.trunc(Number(pageValue) || 1));
  const limit = Math.min(max, Math.max(1, Math.trunc(Number(limitValue) || 20)));
  return { page, limit, skip: (page - 1) * limit };
};
