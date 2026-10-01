import app from "./app.js";
import { ENV } from "./config/env.js";

if (!ENV.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
if (ENV.MODE === "PRODUCTION" && !ENV.FRONTEND_ORIGIN) throw new Error("FRONTEND_ORIGIN is required in production");

app.listen(ENV.PORT, () => {
    console.log(`Server is running on port ${ENV.PORT}`);
});
