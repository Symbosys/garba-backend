import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  getConversationsHandler,
  startConversationHandler,
  getMessagesHandler,
} from "./chat.controller.js";

const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get("/chat/conversations", getConversationsHandler);
chatRouter.post("/chat/conversations/start", startConversationHandler);
chatRouter.get("/chat/conversations/:id/messages", getMessagesHandler);

export { chatRouter };
