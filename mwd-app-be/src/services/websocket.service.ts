import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";

let wss: WebSocketServer | null = null;
const websocketEventEmitter = new EventEmitter();

type WebSocketPayload = Record<string, unknown>;

type WebSocketMessage = {
  event: string;
  payload: WebSocketPayload;
  timestamp: string;
};

const clients = new Set<WebSocket>();

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

const broadcast = (event: string, payload: WebSocketPayload) => {
  if (!wss) return;

  const message = createMessage(event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

export const initializeWebSocket = (
  httpServer: HTTPServer,
): WebSocketServer => {
  wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
  });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);

    console.log(`[Native WS] Client connected. Total clients: ${clients.size}`);

    sendToClient(ws, "connected", {
      message: "Welcome to MWD Monitoring System",
      clientCount: clients.size,
    });

    ws.on("message", (rawMessage) => {
      try {
        const messageText = rawMessage.toString();
        const parsedMessage = JSON.parse(messageText);

        const event = parsedMessage?.event;
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

        websocketEventEmitter.emit(event, ws, payload);
      } catch {
        sendToClient(ws, "error", {
          message: "Invalid WebSocket message format",
        });
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[Native WS] Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on("error", (error) => {
      clients.delete(ws);
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
