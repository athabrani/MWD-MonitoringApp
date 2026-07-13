import { logSecurityDebug } from "@/lib/security/errors";
import { COOKIE_AUTH_SESSION_TOKEN } from "@/lib/security/storage";

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

type RealtimeDiagnosticEvent = {
  timestamp: string;
  event: string;
  status?: RealtimeConnectionState;
  readyState?: number | null;
  attempt?: number;
  delayMs?: number;
  url?: string;
  sessionId?: string;
  code?: number;
  reason?: string;
  error?: string;
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

function getWsUrl(token?: string) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() ?? "";

  if (!wsUrl || typeof window === "undefined") {
    return wsUrl;
  }

  try {
    const parsed = new URL(wsUrl);
    if (parsed.protocol === "http:") {
      parsed.protocol = "ws:";
    }
    if (parsed.protocol === "https:") {
      parsed.protocol = "wss:";
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/ws";
    }
    const frontendHost = window.location.hostname;
    const envUsesLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const frontendUsesLoopback = frontendHost === "localhost" || frontendHost === "127.0.0.1";
    const frontendUsesNetworkHost = !frontendUsesLoopback;

    if (envUsesLoopback && frontendUsesNetworkHost) {
      parsed.hostname = frontendHost;
    }

    if (envUsesLoopback && frontendUsesLoopback && parsed.hostname !== frontendHost) {
      parsed.hostname = frontendHost;
    }

    if (token?.trim() && token !== COOKIE_AUTH_SESSION_TOKEN) {
      parsed.searchParams.set("token", token.trim());
    }

    return parsed.toString();
  } catch {
    return wsUrl;
  }
}

function redactWsUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "REDACTED");
    }
    return parsed.toString();
  } catch {
    return value.replace(/([?&]token=)[^&]+/i, "$1REDACTED");
  }
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

function readSilentRealtimeMessage(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const type = readEventType(parsed);
    if (!type || !silentlyIgnoredEventTypes.has(type.toLowerCase())) return null;

    const payload = parsed.data ?? parsed.payload;
    return {
      type: type.toLowerCase(),
      data: isRecord(payload) ? payload : {},
    };
  } catch {
    return null;
  }
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private connectTimeout: number | null = null;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private subscribedSessionId = "";
  private authToken = "";
  private diagnostics: RealtimeDiagnosticEvent[] = [];
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

  connect(options: { force?: boolean } = {}) {
    if (typeof window === "undefined") return;

    const url = getWsUrl(this.authToken);
    if (!url) {
      this.setStatus("error", "Missing NEXT_PUBLIC_WS_URL.");
      return;
    }

    const socketState = this.socket?.readyState;
    if (
      options.force &&
      this.socket &&
      socketState !== WebSocket.CLOSED &&
      socketState !== WebSocket.CLOSING
    ) {
      this.pushDiagnostic("force-close-existing-socket", { readyState: socketState ?? null });
      this.socket.close();
      this.socket = null;
    }

    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      this.pushDiagnostic("connect-skipped-existing-socket", {
        readyState: this.socket.readyState,
        url: redactWsUrl(url),
      });
      return;
    }

    if (this.socket?.readyState === WebSocket.CLOSED || this.socket?.readyState === WebSocket.CLOSING) {
      this.pushDiagnostic("cleared-closed-socket", { readyState: this.socket.readyState });
      this.socket = null;
    }

    this.clearReconnectTimer();
    this.manualDisconnect = false;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    this.pushDiagnostic("connect-start", {
      attempt: this.reconnectAttempt,
      url: redactWsUrl(url),
      sessionId: this.subscribedSessionId || undefined,
    });

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
      this.socket = socket;
    } catch (error) {
      this.setStatus("error", error instanceof Error ? error.message : "Unable to create WebSocket.");
      this.pushDiagnostic("connect-create-error", {
        error: error instanceof Error ? error.message : "Unable to create WebSocket.",
      });
      this.scheduleReconnect();
      return;
    }

    this.connectTimeout = window.setTimeout(() => {
      if (this.socket !== socket || socket.readyState !== WebSocket.CONNECTING) return;

      this.pushDiagnostic("connect-timeout", {
        readyState: socket.readyState,
        attempt: this.reconnectAttempt,
      });
      this.socket = null;
      socket.close();
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }, 8000);

    socket.addEventListener("open", () => {
      if (this.socket !== socket) return;
      this.clearConnectTimeout();
      this.reconnectAttempt = 0;
      this.setStatus("connected");
      this.pushDiagnostic("onopen", {
        readyState: socket.readyState,
        sessionId: this.subscribedSessionId || undefined,
      });
    });

    socket.addEventListener("message", (message) => {
      if (this.socket !== socket) return;
      if (typeof message.data !== "string") return;

      const silentEvent = readSilentRealtimeMessage(message.data);
      if (silentEvent?.type === "connected" && this.subscribedSessionId) {
        this.sendSubscribe(this.subscribedSessionId);
      }
      if (silentEvent?.type === "subscribed") {
        this.pushDiagnostic("subscription-ack", {
          sessionId:
            typeof silentEvent.data.sessionId === "string" || typeof silentEvent.data.sessionId === "number"
              ? String(silentEvent.data.sessionId)
              : this.subscribedSessionId || undefined,
          readyState: socket.readyState,
        });
      }

      const event = normalizeRealtimeMessage(message.data);
      if (!event) return;

      this.listeners.event.forEach((listener) => listener(event));
    });

    socket.addEventListener("close", (event) => {
      if (this.socket !== socket) return;
      this.clearConnectTimeout();
      this.socket = null;
      this.pushDiagnostic("onclose", {
        code: event.code,
        reason: event.reason,
        attempt: this.reconnectAttempt,
      });
      if (this.manualDisconnect) {
        this.setStatus("idle");
        return;
      }

      this.setStatus("disconnected");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      this.pushDiagnostic("onerror", {
        readyState: socket.readyState,
        attempt: this.reconnectAttempt,
      });
      this.setStatus("error", "Realtime WebSocket error.");
    });
  }

  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.reconnectAttempt = 0;
    this.subscribedSessionId = "";
    this.pushDiagnostic("manual-disconnect");

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.socket = null;
    this.setStatus("idle");
  }

  setAuthToken(token: string | null | undefined) {
    const nextToken = token?.trim() ?? "";
    if (this.authToken === nextToken) return;

    this.authToken = nextToken;
    this.pushDiagnostic("auth-token-updated", {
      readyState: this.socket?.readyState ?? null,
      sessionId: this.subscribedSessionId || undefined,
    });

    if (!this.authToken) {
      this.disconnect();
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.forceReconnect();
    }
  }

  private forceReconnect() {
    this.manualDisconnect = false;
    this.clearReconnectTimer();

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.socket = null;
    this.connect({ force: true });
  }

  closeSocketForE2E() {
    if (process.env.NEXT_PUBLIC_E2E_MODE !== "true") return;
    this.manualDisconnect = false;
    this.pushDiagnostic("e2e-close-socket", {
      readyState: this.socket?.readyState ?? null,
    });

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }
  }

  subscribeSession(sessionId: string | number) {
    const nextSessionId = String(sessionId);
    if (!nextSessionId) return;

    if (this.subscribedSessionId === nextSessionId) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(nextSessionId);
      }
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

  forceReconnectForE2E() {
    if (process.env.NEXT_PUBLIC_E2E_MODE !== "true") return;
    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.pushDiagnostic("e2e-force-reconnect", {
      readyState: this.socket?.readyState ?? null,
      sessionId: this.subscribedSessionId || undefined,
    });

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.socket = null;
    this.connect({ force: true });
  }

  getDiagnosticsForE2E() {
    if (process.env.NEXT_PUBLIC_E2E_MODE !== "true") return [];
    return [...this.diagnostics];
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
    this.pushDiagnostic("subscription-sent", {
      sessionId,
      readyState: this.socket?.readyState ?? null,
    });
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

    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");

    const delay = Math.min(5000, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 2));
    this.pushDiagnostic("reconnect-timer-created", {
      attempt: this.reconnectAttempt,
      delayMs: delay,
      sessionId: this.subscribedSessionId || undefined,
    });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.pushDiagnostic("reconnect-timer-fired", {
        attempt: this.reconnectAttempt,
        sessionId: this.subscribedSessionId || undefined,
      });
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearConnectTimeout() {
    if (!this.connectTimeout) return;

    window.clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  private setStatus(status: RealtimeConnectionState, error?: string) {
    this.status = { status, error };
    this.pushDiagnostic("status", {
      status,
      error,
      readyState: this.socket?.readyState ?? null,
      sessionId: this.subscribedSessionId || undefined,
    });
    this.listeners.status.forEach((listener) => listener(this.status));
  }

  private pushDiagnostic(event: string, details: Omit<RealtimeDiagnosticEvent, "timestamp" | "event"> = {}) {
    if (process.env.NEXT_PUBLIC_E2E_MODE !== "true") return;

    this.diagnostics.push({
      timestamp: new Date().toISOString(),
      event,
      ...details,
    });

    if (this.diagnostics.length > 200) {
      this.diagnostics.splice(0, this.diagnostics.length - 200);
    }
  }
}

let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient() {
  if (!realtimeClient) {
    realtimeClient = new RealtimeClient();
  }

  return realtimeClient;
}

export function closeRealtimeWebSocketForE2E() {
  getRealtimeClient().closeSocketForE2E();
}

export function forceRealtimeReconnectForE2E() {
  getRealtimeClient().forceReconnectForE2E();
}

export function getRealtimeDiagnosticsForE2E() {
  return getRealtimeClient().getDiagnosticsForE2E();
}
