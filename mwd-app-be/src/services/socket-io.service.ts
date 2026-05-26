import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { EventEmitter } from "events";

let io: Server | null = null;
const socketEventEmitter = new EventEmitter();

export type SocketIOEvents = {
  "mwd-data": (data: Record<string, unknown>) => void;
  "connection-status": (status: Record<string, unknown>) => void;
  "esp-gateway-status": (status: Record<string, unknown>) => void;
  "wits-data": (data: Record<string, unknown>) => void;
  "alert": (alert: Record<string, unknown>) => void;
  "error": (error: Record<string, unknown>) => void;
};

export const initializeSocketIO = (httpServer: HTTPServer): Server => {
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    path: "/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send welcome message
    socket.emit("connected", {
      message: "Welcome to MWD Monitoring System",
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle client requesting latest data
    socket.on("request-latest-data", (callback) => {
      socketEventEmitter.emit("request-latest-data", socket.id, callback);
    });

    // Handle custom events
    socket.on("ping", (callback) => {
      callback({ pong: true, timestamp: new Date().toISOString() });
    });
  });

  console.log("Socket.IO initialized successfully");
  return io;
};

export const getSocketIOInstance = (): Server | null => io;

export const getSocketEventEmitter = (): EventEmitter => socketEventEmitter;

export const broadcastMWDData = (data: Record<string, unknown>) => {
  if (!io) return;
  io.emit("mwd-data", {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastConnectionStatus = (status: Record<string, unknown>) => {
  if (!io) return;
  io.emit("connection-status", {
    ...status,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastESPGatewayStatus = (status: Record<string, unknown>) => {
  if (!io) return;
  io.emit("esp-gateway-status", {
    ...status,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastWITSData = (data: Record<string, unknown>) => {
  if (!io) return;
  io.emit("wits-data", {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastAlert = (alert: Record<string, unknown>) => {
  if (!io) return;
  io.emit("alert", {
    ...alert,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastError = (error: Record<string, unknown>) => {
  if (!io) return;
  io.emit("error", {
    ...error,
    timestamp: new Date().toISOString(),
  });
};

export const emitToRoom = (
  roomName: string,
  eventName: string,
  data: Record<string, unknown>,
) => {
  if (!io) return;
  io.to(roomName).emit(eventName, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const joinRoom = (socket: Socket, roomName: string) => {
  socket.join(roomName);
};

export const leaveRoom = (socket: Socket, roomName: string) => {
  socket.leave(roomName);
};
