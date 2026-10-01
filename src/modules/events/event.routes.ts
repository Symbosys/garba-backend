import { Router } from "express";
import { UPLOAD_LIMITS } from "../../config/constants.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import {
  addEventImages,
  addEventSlot,
  createEvent,
  deleteEvent,
  deleteEventImage,
  deleteEventSlot,
  getEvent,
  getOwnEvent,
  listEvents,
  listOwnEvents,
  updateEvent,
  updateEventSlot,
} from "./event.controller.js";

export const eventRouter = Router();
const imageOptions = { allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], maxFileSize: UPLOAD_LIMITS.imageBytes };

// Public Event Discovery
eventRouter.get("/events", listEvents);
eventRouter.get("/events/:eventIdOrSlug", getEvent);

// Organizer Event Management
eventRouter.get("/organizer/events", authenticate, authorize("ORGANIZER"), listOwnEvents);
eventRouter.get("/organizer/events/:eventId", authenticate, authorize("ORGANIZER"), getOwnEvent);
eventRouter.post("/organizer/events", authenticate, authorize("ORGANIZER"), upload.fields([{ name: "images", maxCount: UPLOAD_LIMITS.eventImages }], imageOptions), createEvent);
eventRouter.patch("/organizer/events/:eventId", authenticate, authorize("ORGANIZER"), updateEvent);
eventRouter.delete("/organizer/events/:eventId", authenticate, authorize("ORGANIZER"), deleteEvent);
eventRouter.post("/organizer/events/:eventId/images", authenticate, authorize("ORGANIZER"), upload.fields([{ name: "images", maxCount: UPLOAD_LIMITS.eventImages }], imageOptions), addEventImages);
eventRouter.delete("/organizer/events/:eventId/images/:imageId", authenticate, authorize("ORGANIZER"), deleteEventImage);

// Organizer Dedicated Slot Management
eventRouter.post("/organizer/events/:eventId/slots", authenticate, authorize("ORGANIZER"), addEventSlot);
eventRouter.patch("/organizer/events/:eventId/slots/:slotId", authenticate, authorize("ORGANIZER"), updateEventSlot);
eventRouter.delete("/organizer/events/:eventId/slots/:slotId", authenticate, authorize("ORGANIZER"), deleteEventSlot);


