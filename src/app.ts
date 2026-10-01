import cors from "cors";
import express from "express";
import morgan from "morgan";
import { ENV } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { discoveryRouter } from "./modules/discovery/discovery.routes.js";
import { eventRouter } from "./modules/events/event.routes.js";
import { userRouter } from "./modules/user/user.routes.js";
import { ErrorResponse } from "./utils/response.util.js";
import { statusCode } from "./types/types.js";

const app = express();
const allowedOrigins = ENV.FRONTEND_ORIGIN?.split(",").map((value) => value.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : ENV.MODE === "PRODUCTION" ? false : true }));
app.use(morgan(ENV.MODE === "PRODUCTION" ? "combined" : "dev"));
app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => res.status(200).json({ message: "Welcome to GarbaMitra API", success: true, mode: ENV.MODE }));
app.use("/api/v1", authRouter);
app.use("/api/v1", discoveryRouter);
app.use("/api/v1", eventRouter);
app.use("/api/v1", userRouter);
app.use("/api/v1/super-admin", adminRouter);

app.use((_req, _res, next) => next(new ErrorResponse("Route not found", statusCode.Not_Found)));
app.use(errorMiddleware);

export default app;
