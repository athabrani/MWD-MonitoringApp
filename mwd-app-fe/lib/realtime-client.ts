import { logSecurityDebug } from "@/lib/security/errors";

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export type RealtimeEventType = "mwd-data" | "esp-gateway-status" | "connection-status";

export type RealtimeEvent = {
  type: RealtimeEventType;
  data: Record<string, unknown>;
};

type RealtimeClientStatus = {
  status: RealtimeConnectionState;
  error?: string;
};

type RealtimeClientListeners = {
  event: (event: RealtimeEvent) => void;
  status: (status: RealtimeClientStatus) => void;
};

type RealtimeClientListenerMap = {
  [K in keyof RealtimeClientListeners]: Set<RealtimeClientListeners[K]>;
};

const knownEventTypes = new Set<RealtimeEventType>([
  "mwd-data",
  "esp-gateway-status",
  "connection-status",
]);
const silentlyIgnoredEventTypes = new Set([
  "health",
  "heartbeat",
  "ping",
  "pong",
  "keepalive",
  "keep-alive",
  "connected",
  "subscription",
  "subscribed",
  "unsubscribed",
]);

function getWsUrl() {
  return process.env.NEXT_PUBLIC_WS_URL?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readEventType(message: Record<string, unknown>) {
  const value = message.event ?? message.type ?? message.name;
  return typeof value === "string" ? value : undefined;
}

function normalizeRealtimeMessage(raw: string): RealtimeEvent | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    logSecurityDebug("Ignoring non-JSON realtime message.");
    return null;
  }

  if (!isRecord(parsed)) return null;

  const type = readEventType(parsed);
  if (!type || !knownEventTypes.has(type as RealtimeEventType)) {
    if (type && silentlyIgnoredEventTypes.has(type.toLowerCase())) {
      return null;
    }

    logSecurityDebug("Ignoring unknown realtime event.", {
      type,
      keys: Object.keys(parsed).slice(0, 20),
    });
    return null;
  }

  const payload = parsed.data ?? parsed.payload;
  if (!isRecord(payload)) return null;

  return {
    type: type as RealtimeEventType,
    data: payload,
  };
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private subscribedSessionId = "";
  private status: RealtimeClientStatus = { status: "idle" };
  private listeners: RealtimeClientListenerMap = {
    event: new Set(),
    status: new Set(),
  };

  on<K extends keyof RealtimeClientListeners>(type: K, listener: RealtimeClientListeners[K]) {
    this.listeners[type].add(listener);

    if (type === "status") {
      (listener as RealtimeClientListeners["status"])(this.status);
    }

    return () => {
      this.listeners[type].delete(listener);
    };
  }

  connect() {
    if (typeof window === "undefined") return;

    const url = getWsUrl();
    if (!url) {
      this.setStatus("error", "Missing NEXT_PUBLIC_WS_URL.");
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.clearReconnectTimer();
    this.manualDisconnect = false;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
      this.socket = socket;
    } catch (error) {
      this.setStatus("error", error instanceof Error ? error.message : "Unable to create WebSocket.");
      this.scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      if (this.socket !== socket) return;
      this.reconnectAttempt = 0;
      this.setStatus("connected");
      if (this.subscribedSessionId) {
        this.sendSubscribe(this.subscribedSessionId);
      }
    });

    socket.addEventListener("message", (message) => {
      if (this.socket !== socket) return;
      if (typeof message.data !== "string") return;

      const event = normalizeRealtimeMessage(message.data);
      if (!event) return;

      this.listeners.event.forEach((listener) => listener(event));
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.manualDisconnect) {
        this.setStatus("idle");
        return;
      }

      this.setStatus("disconnected");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      this.setStatus("error", "Realtime WebSocket error.");
    });
  }

  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.subscribedSessionId = "";

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.socket = null;
    this.setStatus("idle");
  }

  subscribeSession(sessionId: string | number) {
    const nextSessionId = String(sessionId);
    if (!nextSessionId) return;

    if (this.subscribedSessionId === nextSessionId) {
      return;
    }

    if (this.subscribedSessionId && this.subscribedSessionId !== nextSessionId) {
      this.sendUnsubscribe(this.subscribedSessionId);
    }

    this.subscribedSessionId = nextSessionId;

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(nextSessionId);
    }
  }

  clearSessionSubscription() {
    if (!this.subscribedSessionId) return;

    const previousSessionId = this.subscribedSessionId;
    this.subscribedSessionId = "";

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(previousSessionId);
    }
  }

  private sendSubscribe(sessionId: string) {
    this.send({
      type: "subscribe",
      sessionId,
    });
  }

  private sendUnsubscribe(sessionId: string) {
    this.send({
      type: "unsubscribe",
      sessionId,
    });
  }

  private send(message: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private scheduleReconnect() {
    if (this.manualDisconnect) return;

    this.clearReconnectTimer();
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");

    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(status: RealtimeConnectionState, error?: string) {
    this.status = { status, error };
    this.listeners.status.forEach((listener) => listener(this.status));
  }
}

let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient() {
  if (!realtimeClient) {
    realtimeClient = new RealtimeClient();
  }

  return realtimeClient;
}
