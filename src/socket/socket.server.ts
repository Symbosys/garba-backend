import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { ENV } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.util.js";
import { registerChatHandlers } from "./handlers/chat.handler.js";

let io: SocketIOServer | null = null;
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = ENV.FRONTEND_ORIGIN?.split(",").map((v) => v.trim()).filter(Boolean);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins?.length ? allowedOrigins : ENV.MODE === "PRODUCTION" ? false : true,
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!authHeader) {
        return next(new Error("Authentication error: Token is required"));
      }

      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      const payload = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, status: true, tokenVersion: true },
      });

      if (!user || user.status !== "APPROVED" || user.tokenVersion !== payload.tokenVersion) {
        return next(new Error("Authentication error: Invalid user session"));
      }

      socket.data.user = user;
      next();
    } catch (err: any) {
      return next(new Error(`Authentication error: ${err.message || "Invalid token"}`));
    }
  });

  // Connection handling
  io.on("connection", (socket) => {
    const user = socket.data.user;
    const userId = user.id;

    // Join user's private notification channel
    socket.join(`user:${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      // Broadcast online status
      io?.emit("user_presence", { userId, isOnline: true });
    }
    onlineUsers.get(userId)?.add(socket.id);

    // Register Chat Handlers
    registerChatHandlers(io!, socket);

    // Disconnect handling
    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status
          io?.emit("user_presence", { userId, isOnline: false });
        }
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io server has not been initialized");
  }
  return io;
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size ?? 0) > 0;
}
