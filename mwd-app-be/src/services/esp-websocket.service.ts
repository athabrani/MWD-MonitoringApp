import * as connectionStatusService from "./connection-status.service.js";
import {
  GatewayIngestError,
  ingestGatewayPayloads,
} from "./gateway-ingest.service.js";

type EspMessage = {
  type?: unknown;
  data?: unknown;
  rssi?: unknown;
  snr?: unknown;
};

type LoRaPacket = {
  payload: string;
  metadata: Record<string, string>;
};

const DEFAULT_RECONNECT_MS = 5000;
const DEFAULT_INGEST_TYPES = ["rx", "tx_ws_only", "raw"];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parsePositiveInt = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const parsePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
};

const parseCsvSet = (value: unknown, fallback: string[]) => {
  if (typeof value !== "string" || !value.trim()) {
    return new Set(fallback);
  }

  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return new Set(values.length ? values : fallback);
};

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const unwrapLoRaPacket = (value: string): LoRaPacket => {
  const parts = value.split("|");
  const metadata: Record<string, string> = {};
  let payloadStartIndex = 0;

  for (const [index, part] of parts.entries()) {
    const match = part.match(/^([A-Z_]+)=(.*)$/);

    if (!match) {
      payloadStartIndex = index;
      break;
    }

    const key = match[1];
    const rawValue = match[2];

    if (key === undefined || rawValue === undefined) {
      payloadStartIndex = index;
      break;
    }

    if (
      key !== "SEQ" &&
      key !== "TS" &&
      key !== "RX_TS" &&
      key !== "RSSI" &&
      key !== "SNR"
    ) {
      payloadStartIndex = index;
      break;
    }

    metadata[key] = rawValue;
    payloadStartIndex = index + 1;
  }

  return {
    metadata,
    payload: parts.slice(payloadStartIndex).join("|").trim(),
  };
};

const parseWitsPairs = (value: string) => {
  const wits: Record<string, string> = {};
  const lines = value
    .replace(/\r/g, "\n")
    .split(/[\n,;|]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line === "&&" || line === "!!") {
      continue;
    }

    const match =
      line.match(/^(\d{4})\s*[:=]\s*([-+]?\d+(?:\.\d+)?)/) ??
      line.match(/^(\d{4})\s+([-+]?\d+(?:\.\d+)?)/) ??
      line.match(/^(\d{4})([-+]?\d+(?:\.\d+)?)$/);

    if (match) {
      const witsId = match[1];
      const rawValue = match[2];

      if (witsId !== undefined && rawValue !== undefined) {
        wits[witsId] = rawValue;
      }
    }
  }

  if (Object.keys(wits).length > 0) {
    return wits;
  }

  const pairPattern = /\b(\d{4})\b\s*[:= ]\s*([-+]?\d+(?:\.\d+)?)/g;
  for (const match of value.matchAll(pairPattern)) {
    const witsId = match[1];
    const rawValue = match[2];

    if (witsId !== undefined && rawValue !== undefined) {
      wits[witsId] = rawValue;
    }
  }

  return wits;
};

const messageDataToString = async (data: unknown) => {
  if (typeof data === "string") {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
      "utf8",
    );
  }

  if (
    isRecord(data) &&
    typeof data.arrayBuffer === "function"
  ) {
    const arrayBuffer = await (
      data as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
    return Buffer.from(arrayBuffer).toString("utf8");
  }

  return String(data);
};

const recordConnectionStatus = async (
  source: string,
  status: string,
  description: string,
  responseMs?: number,
) => {
  try {
    await connectionStatusService.createConnectionStatus({
      source,
      status,
      description,
      ...(responseMs !== undefined ? { responseMs } : {}),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown connection log error";
    console.warn(`[ESP WS] Failed to record connection status: ${message}`);
  }
};

const toGatewayPayload = (
  message: EspMessage,
  defaultSessionId: number | null,
) => {
  if (isRecord(message.data)) {
    const payload: Record<string, unknown> = { ...message.data };

    if (payload.sessionId === undefined && defaultSessionId !== null) {
      payload.sessionId = defaultSessionId;
    }

    return payload;
  }

  if (typeof message.data !== "string") {
    return null;
  }

  const { metadata, payload } = unwrapLoRaPacket(message.data);

  if (!payload) {
    return null;
  }

  const parsedPayload = parseJsonObject(payload);
  const gatewayPayload: Record<string, unknown> = parsedPayload
    ? { ...parsedPayload }
    : { wits: parseWitsPairs(payload) };

  if (
    !parsedPayload &&
    isRecord(gatewayPayload.wits) &&
    Object.keys(gatewayPayload.wits).length === 0
  ) {
    return null;
  }

  if (gatewayPayload.sessionId === undefined && defaultSessionId !== null) {
    gatewayPayload.sessionId = defaultSessionId;
  }

  if (metadata.SEQ !== undefined) {
    gatewayPayload.gatewaySequence = metadata.SEQ;
  }

  if (metadata.TS !== undefined) {
    gatewayPayload.gatewayTxMillis = metadata.TS;
  }

  if (message.rssi !== undefined) {
    gatewayPayload.gatewayRssi = message.rssi;
  }

  if (message.snr !== undefined) {
    gatewayPayload.gatewaySnr = message.snr;
  }

  return gatewayPayload;
};

export const startEspWebSocketGateway = () => {
  const url = process.env.ESP_WS_URL?.trim();

  if (!url) {
    console.log("[ESP WS] Disabled. Set ESP_WS_URL to enable ESP ingestion.");
    return;
  }

  const WebSocketClient = globalThis.WebSocket;

  if (!WebSocketClient) {
    console.warn("[ESP WS] WebSocket client is not available in this Node.js runtime.");
    return;
  }

  const defaultSessionId = parsePositiveInt(process.env.ESP_GATEWAY_SESSION_ID);
  const reconnectMs = parsePositiveNumber(
    process.env.ESP_WS_RECONNECT_MS,
    DEFAULT_RECONNECT_MS,
  );
  const ingestTypes = parseCsvSet(
    process.env.ESP_WS_INGEST_TYPES,
    DEFAULT_INGEST_TYPES,
  );
  const source = process.env.ESP_GATEWAY_SOURCE?.trim() || "esp32-websocket";
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let connectStartedAt = 0;

  if (defaultSessionId === null) {
    console.warn(
      "[ESP WS] ESP_GATEWAY_SESSION_ID is not set. ESP payloads must include sessionId.",
    );
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectMs);
    reconnectTimer.unref();
  };

  const handleMessage = async (rawData: unknown) => {
    const rawMessage = await messageDataToString(rawData);
    const parsedMessage = parseJsonObject(rawMessage);
    const message: EspMessage = parsedMessage
      ? parsedMessage
      : { type: "raw", data: rawMessage };
    const messageType =
      typeof message.type === "string" && message.type.trim()
        ? message.type
        : "raw";

    if (!ingestTypes.has(messageType)) {
      return;
    }

    const gatewayPayload = toGatewayPayload(message, defaultSessionId);

    if (!gatewayPayload) {
      console.warn(`[ESP WS] Ignored ${messageType} message without MWD payload.`);
      return;
    }

    try {
      const createdItems = await ingestGatewayPayloads(gatewayPayload);
      console.log(
        `[ESP WS] Ingested ${createdItems.length} MWD row(s) from ${messageType}.`,
      );
    } catch (error: unknown) {
      if (error instanceof GatewayIngestError) {
        console.warn(`[ESP WS] Ingest rejected: ${error.message}`);
        return;
      }

      const messageText =
        error instanceof Error ? error.message : "Unknown ingest error";
      console.error(`[ESP WS] Ingest failed: ${messageText}`);
    }
  };

  const connect = () => {
    if (stopped) {
      return;
    }

    connectStartedAt = Date.now();
    console.log(`[ESP WS] Connecting to ${url}`);

    try {
      socket = new WebSocketClient(url);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown WebSocket error";
      console.warn(`[ESP WS] Failed to create connection: ${message}`);
      void recordConnectionStatus(source, "offline", message);
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      const responseMs = Date.now() - connectStartedAt;
      console.log(`[ESP WS] Connected to ${url}`);
      void recordConnectionStatus(
        source,
        "connected",
        `Connected to ${url}`,
        responseMs,
      );
    });

    socket.addEventListener("message", (event) => {
      void handleMessage(event.data);
    });

    socket.addEventListener("error", () => {
      console.warn(`[ESP WS] Connection error from ${url}`);
      void recordConnectionStatus(
        source,
        "degraded",
        `WebSocket error from ${url}`,
      );
    });

    socket.addEventListener("close", (event) => {
      const reason = event.reason ? `: ${event.reason}` : "";
      console.warn(`[ESP WS] Closed (${event.code}${reason})`);
      void recordConnectionStatus(
        source,
        "offline",
        `WebSocket closed (${event.code}${reason})`,
      );
      socket = null;
      scheduleReconnect();
    });
  };

  connect();

  return () => {
    stopped = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    socket?.close();
    socket = null;
  };
};
