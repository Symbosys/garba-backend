import { prisma } from "../../lib/prisma.js";
import { ErrorResponse } from "../../utils/response.util.js";
import { statusCode } from "../../types/types.js";

export class ChatService {
  /**
   * Get all active conversations for a user with partner profile & unread counts
   */
  static async getUserConversations(userId: string) {
    const participantRecords = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              where: { userId: { not: userId } },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    age: true,
                    city: true,
                    state: true,
                    role: true,
                    photos: {
                      orderBy: { sortOrder: "asc" },
                      take: 1,
                      select: { url: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          lastMessageAt: "desc",
        },
      },
    });

    return participantRecords.map((record) => {
      const partnerParticipant = record.conversation.participants[0];
      const partnerUser = partnerParticipant?.user;

      return {
        conversationId: record.conversationId,
        partner: partnerUser
          ? {
              id: partnerUser.id,
              name: partnerUser.name,
              age: partnerUser.age,
              city: partnerUser.city,
              state: partnerUser.state,
              role: partnerUser.role,
              avatar: partnerUser.photos[0]?.url || null,
            }
          : null,
        lastMessageText: record.conversation.lastMessageText,
        lastMessageAt: record.conversation.lastMessageAt,
        unreadCount: record.unreadCount,
        lastReadAt: record.lastReadAt,
        isMuted: record.isMuted,
        isArchived: record.isArchived,
      };
    });
  }

  /**
   * Start or retrieve an existing 1-on-1 conversation with a target user
   */
  static async getOrCreateConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ErrorResponse("Cannot create a conversation with yourself", statusCode.Bad_Request);
    }

    // Verify target user exists & is approved
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, status: true },
    });

    if (!targetUser || targetUser.status !== "APPROVED") {
      throw new ErrorResponse("Target user not found or not active", statusCode.Not_Found);
    }

    // Check if 1-on-1 conversation already exists between both users
    const existingParticipation = await prisma.conversationParticipant.findFirst({
      where: {
        userId,
        conversation: {
          participants: {
            some: {
              userId: targetUserId,
            },
          },
        },
      },
      select: {
        conversationId: true,
      },
    });

    if (existingParticipation) {
      return {
        conversationId: existingParticipation.conversationId,
        isNew: false,
      };
    }

    // Create new conversation and both participants in a transaction
    const newConversation = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          lastMessageAt: new Date(),
        },
      });

      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId, unreadCount: 0 },
          { conversationId: conv.id, userId: targetUserId, unreadCount: 0 },
        ],
      });

      return conv;
    });

    return {
      conversationId: newConversation.id,
      isNew: true,
    };
  }

  /**
   * Get paginated chat messages for a conversation
   */
  static async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 30
  ) {
    // Verify user is a member of this conversation
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ErrorResponse("You do not have access to this conversation", statusCode.Forbidden);
    }

    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          status: true,
          seenAt: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              photos: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      }),
      prisma.chatMessage.count({
        where: { conversationId, deletedAt: null },
      }),
    ]);

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      senderAvatar: msg.sender.photos[0]?.url || null,
      content: msg.content,
      status: msg.status,
      seenAt: msg.seenAt,
      createdAt: msg.createdAt,
    }));

    return {
      messages: formattedMessages,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Save a new text message (Called via WebSocket)
   */
  static async saveMessage(conversationId: string, senderId: string, content: string) {
    // Verify sender is in the conversation
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const isMember = participants.some((p) => p.userId === senderId);
    if (!isMember) {
      throw new ErrorResponse("Sender is not a participant of this conversation", statusCode.Forbidden);
    }

    const recipient = participants.find((p) => p.userId !== senderId);

    return await prisma.$transaction(async (tx) => {
      // 1. Create the message
      const message = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId,
          content,
          status: "SENT",
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              photos: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      });

      // 2. Update conversation preview & timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageText: content.substring(0, 500),
          lastMessageAt: message.createdAt,
        },
      });

      // 3. Increment recipient's unread counter
      if (recipient) {
        await tx.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: recipient.userId,
            },
          },
          data: {
            unreadCount: { increment: 1 },
          },
        });
      }

      return {
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: message.sender.name,
          senderAvatar: message.sender.photos[0]?.url || null,
          content: message.content,
          status: message.status,
          seenAt: message.seenAt,
          createdAt: message.createdAt,
        },
        recipientId: recipient?.userId || null,
      };
    });
  }

  /**
   * Mark messages as seen when recipient views the chat
   */
  static async markConversationSeen(conversationId: string, userId: string) {
    // Verify membership
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ErrorResponse("User is not a participant of this conversation", statusCode.Forbidden);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // 1. Mark all unread messages from other user as READ with seenAt = now
      const updateResult = await tx.chatMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          seenAt: null,
        },
        data: {
          status: "READ",
          seenAt: now,
        },
      });

      // 2. Reset user's unread count to 0 & update lastReadAt
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: {
          unreadCount: 0,
          lastReadAt: now,
        },
      });

      return {
        conversationId,
        seenCount: updateResult.count,
        seenAt: now,
        seenBy: userId,
      };
    });
  }
}
