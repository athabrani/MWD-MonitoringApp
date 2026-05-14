import * as connectionStatusService from "./connection-status.service.js";
import {
  GatewayIngestError,
  ingestGatewayPayloads,
} from "./gateway-ingest.service.js";

type SerialPortInstance = {
  open: (callback?: (error: Error | null | undefined) => void) => void;
  close: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => SerialPortInstance;
};

const DEFAULT_BAUD_RATE = 115200;
const DEFAULT_RECONNECT_MS = 5000;
const MAX_BUFFER_LENGTH = 8192;
const SERIAL_METADATA_KEYS = new Set(["SEQ", "TS", "RX_TS", "RSSI", "SNR"]);

const parseBoolean = (value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
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

const parseNumberString = "[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[-+]?\\d+)?";

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const normalizeChunk = async (data: unknown) => {
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

  return String(data);
};

const parseWitsPairs = (text: string) => {
  const wits: Record<string, string> = {};
  const normalizedText = text.replace(/\r/g, "\n");
  const separatedLinePattern = new RegExp(
    `^(\\d{4})\\s*[:,=\\t ]\\s*(${parseNumberString})$`,
    "i",
  );
  const compactLinePattern = new RegExp(`^(\\d{4})(${parseNumberString})$`, "i");
  const globalPairPattern = new RegExp(
    `(?:^|[^\\d])(\\d{4})\\s*[:,=\\t ]\\s*(${parseNumberString})`,
    "gi",
  );

  for (const line of normalizedText.split(/\n|;+/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed === "&&" || trimmed === "!!") {
      continue;
    }

    const separatedMatch = trimmed.match(separatedLinePattern);
    const compactMatch = trimmed.match(compactLinePattern);
    const match = separatedMatch ?? compactMatch;

    if (match?.[1] && match[2]) {
      wits[match[1]] = match[2];
    }
  }

  for (const match of normalizedText.matchAll(globalPairPattern)) {
    const witsId = match[1];
    const value = match[2];

    if (witsId && value) {
      wits[witsId] = value;
    }
  }

  return wits;
};

const parseMwdKeyValuePayload = (text: string) => {
  const payload: Record<string, unknown> = {};
  const fieldAliases: Record<string, string> = {
    depth: "depthMd",
    md: "depthMd",
    depthmd: "depthMd",
    holedepth: "hole_depth",
    bitdepth: "depthMd",
    inc: "inclination",
    inclination: "inclination",
    azi: "azimuth",
    azimuth: "azimuth",
    gamma: "gammaRay",
    gammaray: "gammaRay",
    gr: "gammaRay",
    temp: "temperature",
    temperature: "temperature",
    rop: "rop",
    wob: "hookLoad",
    hookload: "hookLoad",
    pump: "standpipePressure",
    pumppress: "standpipePressure",
    standpipepressure: "standpipePressure",
  };

  for (const part of text.split("|")) {
    const [rawKey, rawValue] = part.split("=");

    if (!rawKey || rawValue === undefined) {
      continue;
    }

    const normalizedKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const fieldName = fieldAliases[normalizedKey];

    if (!fieldName) {
      continue;
    }

    const value = Number(rawValue.trim());

    if (Number.isFinite(value)) {
      payload[fieldName] = value;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
};

const extractSerialParts = (line: string) => {
  const metadata: Record<string, string> = {};
  const payloadParts: string[] = [];

  for (const part of line.split("|")) {
    const trimmed = part.replace(/\0/g, "").trim();

    if (!trimmed) {
      continue;
    }

    const metadataMatch = trimmed.match(/^([A-Z_]+)\s*=\s*(.*)$/);

    if (metadataMatch?.[1] && SERIAL_METADATA_KEYS.has(metadataMatch[1])) {
      metadata[metadataMatch[1]] = metadataMatch[2]?.trim() ?? "";
      continue;
    }

    payloadParts.push(trimmed);
  }

  return {
    metadata,
    payloadText: payloadParts.join("\n").trim(),
  };
};

const recordConnectionStatus = async (
  source: string,
  status: string,
  description: string,
) => {
  try {
    await connectionStatusService.createConnectionStatus({
      source,
      status,
      description,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown connection log error";
    console.warn(`[Serial GW] Failed to record connection status: ${message}`);
  }
};

const getLatestDepthFromWits = (wits: Record<string, string>) => {
  return wits["0110"] ?? wits["0108"] ?? null;
};

export const startSerialGateway = async () => {
  const enabled = parseBoolean(process.env.SERIAL_GATEWAY_ENABLED);
  const portPath = process.env.SERIAL_PORT?.trim();

  if (!enabled) {
    console.log("[Serial GW] Disabled. Set SERIAL_GATEWAY_ENABLED=true to enable serial ingestion.");
    return;
  }

  if (!portPath) {
    console.warn("[Serial GW] SERIAL_PORT is not configured.");
    return;
  }

  const defaultSessionId = parsePositiveInt(
    process.env.SERIAL_GATEWAY_SESSION_ID ?? process.env.ESP_GATEWAY_SESSION_ID,
  );
  const baudRate =
    parsePositiveInt(process.env.SERIAL_BAUD_RATE) ?? DEFAULT_BAUD_RATE;
  const reconnectMs = parsePositiveNumber(
    process.env.SERIAL_GATEWAY_RECONNECT_MS,
    DEFAULT_RECONNECT_MS,
  );
  const verboseLogging = parseBoolean(process.env.SERIAL_GATEWAY_VERBOSE);
  const source = process.env.SERIAL_GATEWAY_SOURCE?.trim() || "esp32-serial";

  if (defaultSessionId === null) {
    console.warn(
      "[Serial GW] SERIAL_GATEWAY_SESSION_ID is not set. Serial payloads must include sessionId.",
    );
  }

  let SerialPortClass: typeof import("serialport").SerialPort;

  try {
    ({ SerialPort: SerialPortClass } = await import("serialport"));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown serialport import error";
    console.warn(`[Serial GW] serialport package is unavailable: ${message}`);
    return;
  }

  let port: SerialPortInstance | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let buffer = "";
  let latestDepthMd: string | null = null;
  let lastIgnoredLineLogAt = 0;

  const logIgnoredLine = (message: string) => {
    const now = Date.now();

    if (!verboseLogging && now - lastIgnoredLineLogAt < 5000) {
      return;
    }

    lastIgnoredLineLogAt = now;
    console.warn(message);
  };

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

  const ingestSerialLine = async (rawLine: string) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    if (verboseLogging) {
      console.log(`[Serial GW] RAW: ${line}`);
    }

    const { metadata, payloadText } = extractSerialParts(line);

    if (!payloadText) {
      logIgnoredLine(`[Serial GW] Signal/status only: ${line}`);
      return;
    }

    const parsedJsonPayload = parseJsonObject(payloadText);
    const wits = parsedJsonPayload ? {} : parseWitsPairs(payloadText);
    const mwdPayload = parsedJsonPayload
      ? parsedJsonPayload
      : parseMwdKeyValuePayload(payloadText);

    if (verboseLogging && Object.keys(wits).length > 0) {
      console.log(`[Serial GW] Parsed WITS IDs: ${Object.keys(wits).join(", ")}`);
    }

    if (!parsedJsonPayload && !mwdPayload && Object.keys(wits).length === 0) {
      logIgnoredLine(`[Serial GW] Ignored line without MWD/WITS payload: ${line}`);
      return;
    }

    const depthFromWits = getLatestDepthFromWits(wits);

    if (depthFromWits !== null) {
      latestDepthMd = depthFromWits;
    }

    const gatewayPayload: Record<string, unknown> = {
      ...(mwdPayload ?? {}),
      measuredAt: new Date().toISOString(),
      gatewaySource: source,
    };

    if (defaultSessionId !== null && gatewayPayload.sessionId === undefined) {
      gatewayPayload.sessionId = defaultSessionId;
    }

    if (!parsedJsonPayload && Object.keys(wits).length > 0) {
      gatewayPayload.wits = wits;
    }

    if (
      gatewayPayload.depthMd === undefined &&
      latestDepthMd !== null &&
      depthFromWits === null
    ) {
      gatewayPayload.depthMd = latestDepthMd;
    }

    if (metadata.SEQ !== undefined) {
      gatewayPayload.gatewaySequence = metadata.SEQ;
    }

    if (metadata.TS !== undefined) {
      gatewayPayload.gatewayTxMillis = metadata.TS;
    }

    if (metadata.RX_TS !== undefined) {
      gatewayPayload.gatewayRxMillis = metadata.RX_TS;
    }

    if (metadata.RSSI !== undefined) {
      gatewayPayload.gatewayRssi = metadata.RSSI;
    }

    if (metadata.SNR !== undefined) {
      gatewayPayload.gatewaySnr = metadata.SNR;
    }

    try {
      const createdItems = await ingestGatewayPayloads(gatewayPayload);
      console.log(
        `[Serial GW] Ingested ${createdItems.length} MWD row(s) from ${portPath}: ${payloadText}`,
      );
    } catch (error: unknown) {
      if (error instanceof GatewayIngestError) {
        console.warn(`[Serial GW] Ingest rejected: ${error.message}`);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unknown ingest error";
      console.error(`[Serial GW] Ingest failed: ${message}`);
    }
  };

  const handleSerialData = (data: unknown) => {
    void normalizeChunk(data).then((chunk) => {
      buffer += chunk;

      if (buffer.length > MAX_BUFFER_LENGTH) {
        buffer = buffer.slice(-MAX_BUFFER_LENGTH);
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        void ingestSerialLine(line);
      }
    });
  };

  const connect = () => {
    if (stopped) {
      return;
    }

    console.log(`[Serial GW] Opening ${portPath} @ ${baudRate}`);
    port = new SerialPortClass({
      path: portPath,
      baudRate,
      autoOpen: false,
    }) as unknown as SerialPortInstance;

    port.on("open", () => {
      console.log(`[Serial GW] Connected to ${portPath}`);
      void recordConnectionStatus(
        source,
        "connected",
        `Serial connected to ${portPath} @ ${baudRate}`,
      );
    });

    port.on("data", handleSerialData);

    port.on("error", (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown serial error";
      console.warn(`[Serial GW] Error on ${portPath}: ${message}`);
      void recordConnectionStatus(source, "degraded", message);
    });

    port.on("close", () => {
      console.warn(`[Serial GW] Closed ${portPath}`);
      void recordConnectionStatus(source, "offline", `Serial closed ${portPath}`);
      port = null;
      scheduleReconnect();
    });

    port.open((error) => {
      if (!error) {
        return;
      }

      const message = error.message || "Unknown serial open error";
      console.warn(`[Serial GW] Failed to open ${portPath}: ${message}`);
      void recordConnectionStatus(source, "offline", message);
      port = null;
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

    port?.close();
    port = null;
  };
};
