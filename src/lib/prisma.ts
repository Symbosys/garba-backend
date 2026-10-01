import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { ENV } from "../config/env.js";

if (!ENV.DATABASE_URL) throw new Error("DATABASE_URL is required");

const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
