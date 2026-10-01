import jwt, { type JwtPayload } from "jsonwebtoken";
import { ENV } from "../config/env.js";

const ISSUER = "garba-mitra-api";
const AUDIENCE = "garba-mitra-web";

function secret(): string {
  if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return ENV.JWT_SECRET;
}

export interface AccessTokenPayload extends JwtPayload { sub: string; tokenVersion: number }

export const generateToken = (userId: string, tokenVersion: number) => jwt.sign(
  { tokenVersion }, secret(),
  { algorithm: "HS256", subject: userId, issuer: ISSUER, audience: AUDIENCE, expiresIn: "15m" },
);

export const verifyToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
  if (typeof payload === "string" || !payload.sub) throw new Error("Invalid access token");
  return payload as AccessTokenPayload;
};
