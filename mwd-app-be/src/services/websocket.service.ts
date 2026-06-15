import { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { isCorsOriginAllowed } from "../config/cors.js";
import * as authService from "./auth.service.js";
import * as sessionService from "./mwd-session.service.js";
import { canAccessSessionOwner } from "../utils/roles.js";

let wss: WebSocketServer | null = null;
const websocketEventEmitter = new EventEmitter();

type WebSocketPayload = Record<string, unknown>;

type WebSocketMessage = {
  event: string;
  payload: WebSocketPayload;
  timestamp: string;
};

type WebSocketUser = {
  userId: number;
  roleName: string;
};

const clients = new Set<WebSocket>();
const authenticatedClients = new WeakMap<WebSocket, WebSocketUser>();
const clientSubscriptions = new WeakMap<WebSocket, Set<number>>();

const safeJsonReplacer = (_key: string, value: unknown) => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    const constructorName = value.constructor?.name;

    if (constructorName === "Decimal") {
      return value.toString();
    }
  }

  return value;
};

const createMessage = (
  event: string,
  payload: WebSocketPayload,
): string => {
  const message: WebSocketMessage = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(message, safeJsonReplacer);
};

const sendToClient = (
  client: WebSocket,
  event: string,
  payload: WebSocketPayload,
) => {
  if (client.readyState !== WebSocket.OPEN) return;

  client.send(createMessage(event, payload));
};

const getTokenFromRequest = (request: IncomingMessage) => {
  try {
    const parsed = new URL(request.url ?? "/ws", "http://localhost");
    return parsed.searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
};

const authenticateWebSocketRequest = async (
  request: IncomingMessage,
): Promise<WebSocketUser | null> => {
  const token = getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    const currentUser = await authService.getCurrentUser(payload.userId);

    if (!currentUser || !currentUser.isActive) {
      return null;
    }

    return {
      userId: currentUser.id,
      roleName: currentUser.role.name,
    };
  } catch {
    return null;
  }
};

const parseSessionId = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isClientSubscribedToSession = (
  client: WebSocket,
  sessionId: unknown,
) => {
  const parsedSessionId = parseSessionId(sessionId);

  if (parsedSessionId === null) {
    return true;
  }

  return clientSubscriptions.get(client)?.has(parsedSessionId) ?? false;
};

const broadcast = (event: string, payload: WebSocketPayload) => {
  if (!wss) return;

  const message = createMessage(event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });

  let targetCount = 0;
  clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      isClientSubscribedToSession(client, payload.sessionId)
    ) {
      targetCount += 1;
      client.send(message);
    }
  });

  if (event === "mwd-data" || event === "connection-status") {
    console.log(`[Native WS] Broadcast ${event}. Target clients: ${targetCount}`);
  }
};

const handleSubscription = async (
  ws: WebSocket,
  event: "subscribe" | "unsubscribe",
  payload: WebSocketPayload,
  sessionIdValue: unknown,
) => {
  const sessionId = parseSessionId(sessionIdValue);
  const user = authenticatedClients.get(ws);

  if (sessionId === null) {
    sendToClient(ws, "error", {
      message: "Valid sessionId is required",
    });
    return;
  }

  const session = await sessionService.getSessionById(sessionId);

  if (
    !user ||
    !session ||
    !canAccessSessionOwner(user.roleName, user.userId, session.userId)
  ) {
    sendToClient(ws, "error", {
      message: "Forbidden",
    });
    return;
  }

  const subscriptions = clientSubscriptions.get(ws) ?? new Set<number>();

  if (event === "subscribe") {
    subscriptions.add(sessionId);
  } else {
    subscriptions.delete(sessionId);
  }

  clientSubscriptions.set(ws, subscriptions);
  websocketEventEmitter.emit(event, ws, { ...payload, sessionId });
  console.log(`[Native WS] Session ${event} received. Has session: true`);
  sendToClient(ws, event === "subscribe" ? "subscribed" : "unsubscribed", {
    sessionId,
  });
};

export const initializeWebSocket = (
  httpServer: HTTPServer,
): WebSocketServer => {
  wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    verifyClient: ({ origin }, done) => {
      if (isCorsOriginAllowed(origin)) {
        return done(true);
      }

      return done(false, 403, "CORS origin not allowed");
    },
  });

  wss.on("connection", async (ws: WebSocket, request) => {
    const user = await authenticateWebSocketRequest(request);

    if (!user) {
      ws.close(1008, "Unauthorized");
      console.warn("[Native WS] Rejected unauthenticated client.");
      return;
    }

    clients.add(ws);
    authenticatedClients.set(ws, user);
    clientSubscriptions.set(ws, new Set());

    console.log(`[Native WS] Client authenticated. Total clients: ${clients.size}`);

    sendToClient(ws, "connected", {
      message: "Welcome to MWD Monitoring System",
      clientCount: clients.size,
    });

    ws.on("message", (rawMessage) => {
      void (async () => {
        try {
          const messageText = rawMessage.toString();
          const parsedMessage = JSON.parse(messageText);

          const event = parsedMessage?.event ?? parsedMessage?.type;
          const payload = parsedMessage?.payload ?? {};

          if (event === "ping") {
            sendToClient(ws, "pong", {
              pong: true,
            });
            return;
          }

          if (event === "request-latest-data") {
            websocketEventEmitter.emit("request-latest-data", ws, payload);
            return;
          }

          if (event === "subscribe" || event === "unsubscribe") {
            const sessionId =
              parsedMessage?.sessionId ?? parsedMessage?.payload?.sessionId ?? null;
            await handleSubscription(ws, event, payload, sessionId);
            return;
          }

          if (typeof event === "string" && event.trim()) {
            websocketEventEmitter.emit(event, ws, payload);
          }
        } catch {
          sendToClient(ws, "error", {
            message: "Invalid WebSocket message format",
          });
        }
      })();
    });

    ws.on("close", () => {
      clients.delete(ws);
      clientSubscriptions.delete(ws);
      console.log(`[Native WS] Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on("error", (error) => {
      clients.delete(ws);
      clientSubscriptions.delete(ws);
      console.error(`[Native WS] Client error: ${error.message}`);
    });
  });

  console.log("Native WebSocket initialized successfully on path /ws");

  return wss;
};

export const getWebSocketInstance = (): WebSocketServer | null => wss;

export const getWebSocketEventEmitter = (): EventEmitter => websocketEventEmitter;

export const broadcastMWDData = (data: WebSocketPayload) => {
  broadcast("mwd-data", data);
};

export const broadcastConnectionStatus = (status: WebSocketPayload) => {
  broadcast("connection-status", status);
};

export const broadcastESPGatewayStatus = (status: WebSocketPayload) => {
  broadcast("esp-gateway-status", status);
};

export const broadcastGatewayRawPacket = (packet: WebSocketPayload) => {
  broadcast("gateway-raw-packet", packet);
};

export const broadcastWITSData = (data: WebSocketPayload) => {
  broadcast("wits-data", data);
};

export const broadcastAlert = (alert: WebSocketPayload) => {
  broadcast("alert", alert);
};

export const broadcastError = (error: WebSocketPayload) => {
  broadcast("error", error);
};

export const emitToClient = (
  client: WebSocket,
  event: string,
  payload: WebSocketPayload,
) => {
  sendToClient(client, event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

export const getConnectedClientCount = (): number => {
  return clients.size;
};
