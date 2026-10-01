import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { getPartner, listPartners } from "./discovery.controller.js";

export const discoveryRouter = Router();
discoveryRouter.use(authenticate);
discoveryRouter.get("/partners", listPartners);
discoveryRouter.get("/partners/:partnerId", getPartner);
