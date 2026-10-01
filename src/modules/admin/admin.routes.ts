import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { getAdminEvent, getDashboard, getRegistration, listAllEvents, listRegistrations, reviewRegistration } from "./admin.controller.js";

export const adminRouter = Router();
adminRouter.use(authenticate, authorize("SUPER_ADMIN"));
adminRouter.get("/dashboard", getDashboard);
adminRouter.get("/registrations", listRegistrations);
adminRouter.get("/registrations/:userId", getRegistration);
adminRouter.patch("/registrations/:userId/review", reviewRegistration);
adminRouter.get("/events", listAllEvents);
adminRouter.get("/events/:eventId", getAdminEvent);
