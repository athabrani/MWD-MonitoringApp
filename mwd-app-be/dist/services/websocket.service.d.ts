import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
type WebSocketPayload = Record<string, unknown>;
export declare const initializeWebSocket: (httpServer: HTTPServer) => WebSocketServer;
export declare const getWebSocketInstance: () => WebSocketServer | null;
export declare const getWebSocketEventEmitter: () => EventEmitter;
export declare const broadcastMWDData: (data: WebSocketPayload) => void;
export declare const broadcastConnectionStatus: (status: WebSocketPayload) => void;
export declare const broadcastESPGatewayStatus: (status: WebSocketPayload) => void;
export declare const broadcastGatewayRawPacket: (packet: WebSocketPayload) => void;
export declare const broadcastWITSData: (data: WebSocketPayload) => void;
export declare const broadcastAlert: (alert: WebSocketPayload) => void;
export declare const broadcastError: (error: WebSocketPayload) => void;
export declare const emitToClient: (client: WebSocket, event: string, payload: WebSocketPayload) => void;
export declare const getConnectedClientCount: () => number;
export {};
//# sourceMappingURL=websocket.service.d.ts.map