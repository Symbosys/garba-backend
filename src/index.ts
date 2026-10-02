import http from "http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { initializeSocketServer } from "./socket/socket.server.js";

if (!ENV.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
if (ENV.MODE === "PRODUCTION" && !ENV.FRONTEND_ORIGIN) throw new Error("FRONTEND_ORIGIN is required in production");

const httpServer = http.createServer(app);

// Initialize WebSocket server with real-time chat & presence
initializeSocketServer(httpServer);

httpServer.listen(ENV.PORT, () => {
  console.log(`Server & WebSocket running on port ${ENV.PORT}`);
});
