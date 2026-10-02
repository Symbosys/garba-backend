import { z } from "zod";

export const startConversationSchema = z.object({
  targetUserId: z.string().uuid("Invalid target user ID"),
});

export const getMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message cannot exceed 2000 characters"),
});

export const markSeenSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MarkSeenInput = z.infer<typeof markSeenSchema>;
