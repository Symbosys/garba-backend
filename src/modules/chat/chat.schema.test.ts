import { describe, expect, test } from "bun:test";
import {
  startConversationSchema,
  sendMessageSchema,
  markSeenSchema,
  getMessagesQuerySchema,
} from "./chat.schema.js";

describe("Chat Validation Schemas", () => {
  describe("startConversationSchema", () => {
    test("validates valid target user UUID", () => {
      const validUUID = "a59467c4-9331-4b24-99b0-da4e43fa27e2";
      const result = startConversationSchema.safeParse({ targetUserId: validUUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetUserId).toBe(validUUID);
      }
    });

    test("rejects invalid UUID for targetUserId", () => {
      const result = startConversationSchema.safeParse({ targetUserId: "not-a-valid-uuid" });
      expect(result.success).toBe(false);
    });

    test("rejects missing targetUserId", () => {
      const result = startConversationSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("sendMessageSchema", () => {
    const validConvId = "c1111111-1111-4111-8111-111111111111";

    test("validates valid text message", () => {
      const result = sendMessageSchema.safeParse({
        conversationId: validConvId,
        content: "Hey, are you going to Ranchi Garba Night?",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Hey, are you going to Ranchi Garba Night?");
      }
    });

    test("trims whitespace from content", () => {
      const result = sendMessageSchema.safeParse({
        conversationId: validConvId,
        content: "   Hello there!   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Hello there!");
      }
    });

    test("rejects empty message content", () => {
      const result = sendMessageSchema.safeParse({
        conversationId: validConvId,
        content: "    ",
      });
      expect(result.success).toBe(false);
    });

    test("rejects message exceeding 2000 characters", () => {
      const longMessage = "a".repeat(2001);
      const result = sendMessageSchema.safeParse({
        conversationId: validConvId,
        content: longMessage,
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid conversation UUID", () => {
      const result = sendMessageSchema.safeParse({
        conversationId: "invalid-id",
        content: "Hello",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("markSeenSchema", () => {
    test("validates valid conversationId", () => {
      const validConvId = "b2222222-2222-4222-8222-222222222222";
      const result = markSeenSchema.safeParse({ conversationId: validConvId });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conversationId).toBe(validConvId);
      }
    });

    test("rejects invalid conversationId", () => {
      const result = markSeenSchema.safeParse({ conversationId: "bad-uuid" });
      expect(result.success).toBe(false);
    });
  });

  describe("getMessagesQuerySchema", () => {
    test("defaults page to 1 and limit to 30", () => {
      const result = getMessagesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(30);
      }
    });

    test("coerces string query parameters", () => {
      const result = getMessagesQuerySchema.safeParse({
        page: "2",
        limit: "50",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    test("enforces maximum limit of 100", () => {
      const result = getMessagesQuerySchema.safeParse({
        limit: "150",
      });
      expect(result.success).toBe(false);
    });

    test("rejects negative or zero page number", () => {
      const result = getMessagesQuerySchema.safeParse({
        page: "0",
      });
      expect(result.success).toBe(false);
    });
  });
});
