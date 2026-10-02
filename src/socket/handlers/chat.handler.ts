import type { Server, Socket } from "socket.io";
import { ChatService } from "../../modules/chat/chat.service.js";
import { sendMessageSchema, markSeenSchema } from "../../modules/chat/chat.schema.js";

export function registerChatHandlers(io: Server, socket: Socket) {
  const currentUser = socket.data.user;

  /**
   * 1. Join a specific conversation room
   */
  socket.on("join_conversation", async (data: { conversationId: string }, callback?: (res: any) => void) => {
    try {
      if (!data?.conversationId) {
        callback?.({ success: false, message: "conversationId is required" });
        return;
      }
      const room = `conversation:${data.conversationId}`;
      await socket.join(room);
      callback?.({ success: true, room });
    } catch (error: any) {
      callback?.({ success: false, message: error.message || "Failed to join room" });
    }
  });

  /**
   * 2. Leave a specific conversation room
   */
  socket.on("leave_conversation", async (data: { conversationId: string }, callback?: (res: any) => void) => {
    try {
      if (!data?.conversationId) return;
      const room = `conversation:${data.conversationId}`;
      await socket.leave(room);
      callback?.({ success: true });
    } catch (error: any) {
      callback?.({ success: false, message: error.message });
    }
  });

  /**
   * 3. Send a message over WebSocket
   */
  socket.on(
    "send_message",
    async (
      payload: { conversationId: string; content: string; clientTempId?: string },
      callback?: (res: any) => void
    ) => {
      try {
        const parsed = sendMessageSchema.safeParse(payload);
        if (!parsed.success) {
          const err = parsed.error.issues[0]?.message || "Invalid message format";
          callback?.({ success: false, message: err });
          socket.emit("chat_error", { message: err });
          return;
        }

        const { conversationId, content } = parsed.data;

        // Persist message & update conversation in database
        const { message, recipientId } = await ChatService.saveMessage(
          conversationId,
          currentUser.id,
          content
        );

        // Acknowledge back to sender
        callback?.({
          success: true,
          data: message,
          clientTempId: payload.clientTempId,
        });

        socket.emit("message_sent", {
          message,
          clientTempId: payload.clientTempId,
        });

        // Broadcast to active conversation room (sender + receiver if in room)
        io.to(`conversation:${conversationId}`).emit("new_message", {
          message,
          conversationId,
        });

        // Also push to recipient's personal user room (for unread count badge & push notification)
        if (recipientId) {
          io.to(`user:${recipientId}`).emit("new_message_notification", {
            conversationId,
            message,
          });
        }
      } catch (error: any) {
        callback?.({ success: false, message: error.message || "Failed to send message" });
        socket.emit("chat_error", { message: error.message || "Failed to send message" });
      }
    }
  );

  /**
   * 4. Mark conversation messages as Seen
   */
  socket.on("mark_seen", async (data: { conversationId: string }, callback?: (res: any) => void) => {
    try {
      const parsed = markSeenSchema.safeParse(data);
      if (!parsed.success) {
        callback?.({ success: false, message: "Invalid conversation ID" });
        return;
      }

      const { conversationId } = parsed.data;

      // Update database status = READ, seenAt = now, unreadCount = 0
      const result = await ChatService.markConversationSeen(conversationId, currentUser.id);

      callback?.({ success: true, data: result });

      // Notify other participant in the conversation room that their messages were seen
      io.to(`conversation:${conversationId}`).emit("messages_seen", {
        conversationId,
        seenAt: result.seenAt,
        seenBy: currentUser.id,
      });

      // Notify the current user that unread count has been cleared
      socket.emit("unread_count_reset", { conversationId });
    } catch (error: any) {
      callback?.({ success: false, message: error.message || "Failed to mark seen" });
    }
  });

  /**
   * 5. Typing indicator events
   */
  socket.on("typing_start", (data: { conversationId: string }) => {
    if (!data?.conversationId) return;
    socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
      conversationId: data.conversationId,
      userId: currentUser.id,
      userName: currentUser.name,
      isTyping: true,
    });
  });

  socket.on("typing_stop", (data: { conversationId: string }) => {
    if (!data?.conversationId) return;
    socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
      conversationId: data.conversationId,
      userId: currentUser.id,
      userName: currentUser.name,
      isTyping: false,
    });
  });
}
