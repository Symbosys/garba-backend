import type { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../utils/response.util.js";
import { statusCode } from "../../types/types.js";
import { startConversationSchema, getMessagesQuerySchema } from "./chat.schema.js";
import { ChatService } from "./chat.service.js";

/**
 * GET /api/v1/chat/conversations
 * Fetch all conversations for the authenticated user
 */
export const getConversationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) throw new ErrorResponse("Unauthorized", statusCode.Unauthorized);

  const conversations = await ChatService.getUserConversations(userId);
  return SuccessResponse(res, "Conversations fetched successfully", conversations, statusCode.OK);
});

/**
 * POST /api/v1/chat/conversations/start
 * Start or retrieve 1-on-1 chat with a partner
 */
export const startConversationHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) throw new ErrorResponse("Unauthorized", statusCode.Unauthorized);

  const parsed = startConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse(parsed.error.issues[0]?.message || "Invalid input", statusCode.Bad_Request);
  }

  const result = await ChatService.getOrCreateConversation(userId, parsed.data.targetUserId);
  return SuccessResponse(
    res,
    result.isNew ? "Conversation started" : "Conversation retrieved",
    result,
    result.isNew ? statusCode.Created : statusCode.OK
  );
});

/**
 * GET /api/v1/chat/conversations/:id/messages
 * Fetch paginated chat history for a conversation
 */
export const getMessagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) throw new ErrorResponse("Unauthorized", statusCode.Unauthorized);

  const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!conversationId) throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);

  const parsedQuery = getMessagesQuerySchema.safeParse(req.query);
  const { page, limit } = parsedQuery.success ? parsedQuery.data : { page: 1, limit: 30 };

  const data = await ChatService.getConversationMessages(conversationId, userId, page, limit);
  return SuccessResponse(res, "Messages fetched successfully", data, statusCode.OK);
});

