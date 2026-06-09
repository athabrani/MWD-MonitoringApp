import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
let wss = null;
const websocketEventEmitter = new EventEmitter();
const clients = new Set();
const safeJsonReplacer = (_key, value) => {
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
const createMessage = (event, payload) => {
    const message = {
        event,
        payload,
        timestamp: new Date().toISOString(),
    };
    return JSON.stringify(message, safeJsonReplacer);
};
const sendToClient = (client, event, payload) => {
    if (client.readyState !== WebSocket.OPEN)
        return;
    client.send(createMessage(event, payload));
};
const broadcast = (event, payload) => {
    if (!wss)
        return;
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
export const initializeWebSocket = (httpServer) => {
    wss = new WebSocketServer({
        server: httpServer,
        path: "/ws",
    });
    wss.on("connection", (ws) => {
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
            }
            catch {
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
export const getWebSocketInstance = () => wss;
export const getWebSocketEventEmitter = () => websocketEventEmitter;
export const broadcastMWDData = (data) => {
    broadcast("mwd-data", data);
};
export const broadcastConnectionStatus = (status) => {
    broadcast("connection-status", status);
};
export const broadcastESPGatewayStatus = (status) => {
    broadcast("esp-gateway-status", status);
};
export const broadcastGatewayRawPacket = (packet) => {
    broadcast("gateway-raw-packet", packet);
};
export const broadcastWITSData = (data) => {
    broadcast("wits-data", data);
};
export const broadcastAlert = (alert) => {
    broadcast("alert", alert);
};
export const broadcastError = (error) => {
    broadcast("error", error);
};
export const emitToClient = (client, event, payload) => {
    sendToClient(client, event, {
        ...payload,
        timestamp: new Date().toISOString(),
    });
};
export const getConnectedClientCount = () => {
    return clients.size;
};
//# sourceMappingURL=websocket.service.js.map