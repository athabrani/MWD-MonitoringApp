import * as connectionStatusService from "./connection-status.service.js";
import { GatewayIngestError } from "./gateway-ingest.service.js";
import { submitGatewayCandidate } from "./gateway-fusion.service.js";
import { createGatewayRawPacketLog } from "./gateway-raw-packet-log.service.js";
import {
  type ParsedSerialWitsBlock,
  SerialWitsStreamParser,
} from "../utils/serial-wits-parser.js";

type SerialPortInstance = {
  open: (callback?: (error: Error | null | undefined) => void) => void;
  close: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => SerialPortInstance;
};

export type SerialGatewayConnectOptions = {
  path: string;
  baudRate?: number;
  sessionId?: number;
  source?: string;
  transmitterId?: string;
  reconnectMs?: number;
  verbose?: boolean;
};

export type SerialGatewayStatus = {
  enabled: boolean;
  connected: boolean;
  reconnecting: boolean;
  path: string | null;
  baudRate: number | null;
  sessionId: number | null;
  source: string;
  transmitterId: string | null;
  startedAt: string | null;
  connectedAt: string | null;
  lastReceivedAt: string | null;
  lastIngestedAt: string | null;
  lastLine: string | null;
  lastPayload: string | null;
  lastError: string | null;
  signal: {
    rssi: number | null;
    snr: number | null;
    sequence: string | null;
    quality: "unknown" | "good" | "fair" | "poor";
    lastUpdatedAt: string | null;
  };
  ingestedCount: number;
  ignoredCount: number;
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

const parseSignalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/[-+]?\d+(?:\.\d+)?/);
  const parsed = match?.[0] ? Number(match[0]) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
};

const getSignalQuality = (
  rssi: number | null,
  snr: number | null,
): "unknown" | "good" | "fair" | "poor" => {
  if (rssi === null && snr === null) {
    return "unknown";
  }

  if ((rssi !== null && rssi <= -95) || (snr !== null && snr < 3)) {
    return "poor";
  }

  if ((rssi !== null && rssi <= -80) || (snr !== null && snr < 7)) {
    return "fair";
  }

  return "good";
};

const updateSignalStatus = (
  metadata: Record<string, string>,
  rawLine: string,
) => {
  const rssi =
    parseSignalNumber(metadata.RSSI) ??
    parseSignalNumber(rawLine.match(/RSSI\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1]);
  const snr =
    parseSignalNumber(metadata.SNR) ??
    parseSignalNumber(rawLine.match(/SNR\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1]);
  const sequence =
    metadata.SEQ ??
    rawLine.match(/(?:^|[|\s,])SEQ\s*=\s*([A-Za-z0-9_.-]+)/i)?.[1] ??
    null;

  if (rssi === null && snr === null && sequence === null) {
    return;
  }

  runtimeStatus.signal.rssi = rssi ?? runtimeStatus.signal.rssi;
  runtimeStatus.signal.snr = snr ?? runtimeStatus.signal.snr;
  runtimeStatus.signal.sequence = sequence ?? runtimeStatus.signal.sequence;
  runtimeStatus.signal.quality = getSignalQuality(
    runtimeStatus.signal.rssi,
    runtimeStatus.signal.snr,
  );
  runtimeStatus.signal.lastUpdatedAt = new Date().toISOString();
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
  return wits["0108"] ?? wits["0110"] ?? null;
};

let SerialPortClassCache: typeof import("serialport").SerialPort | null = null;
let port: SerialPortInstance | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let activeOptions: Required<SerialGatewayConnectOptions> | null = null;
let stopped = true;
let witsStreamParser = new SerialWitsStreamParser(MAX_BUFFER_LENGTH);
let latestDepthMd: string | null = null;
let lastIgnoredLineLogAt = 0;

const runtimeStatus: SerialGatewayStatus = {
  enabled: false,
  connected: false,
  reconnecting: false,
  path: null,
  baudRate: null,
  sessionId: null,
  source: "esp32-serial",
  transmitterId: null,
  startedAt: null,
  connectedAt: null,
  lastReceivedAt: null,
  lastIngestedAt: null,
  lastLine: null,
  lastPayload: null,
  lastError: null,
  signal: {
    rssi: null,
    snr: null,
    sequence: null,
    quality: "unknown",
    lastUpdatedAt: null,
  },
  ingestedCount: 0,
  ignoredCount: 0,
};

const loadSerialPortClass = async () => {
  if (SerialPortClassCache) {
    return SerialPortClassCache;
  }

  try {
    const serialport = await import("serialport");
    SerialPortClassCache = serialport.SerialPort;
    return SerialPortClassCache;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown serialport import error";
    runtimeStatus.lastError = message;
    console.warn(`[Serial GW] serialport package is unavailable: ${message}`);
    return null;
  }
};

export const listSerialPorts = async () => {
  const SerialPortClass = await loadSerialPortClass();

  if (!SerialPortClass) {
    return [];
  }

  return SerialPortClass.list();
};

export const getSerialGatewayStatus = () => ({
  ...runtimeStatus,
});

const resetRuntimeStatusForConnect = (
  options: Required<SerialGatewayConnectOptions>,
) => {
  runtimeStatus.enabled = true;
  runtimeStatus.connected = false;
  runtimeStatus.reconnecting = false;
  runtimeStatus.path = options.path;
  runtimeStatus.baudRate = options.baudRate;
  runtimeStatus.sessionId = options.sessionId > 0 ? options.sessionId : null;
  runtimeStatus.source = options.source;
  runtimeStatus.transmitterId = options.transmitterId || null;
  runtimeStatus.startedAt = new Date().toISOString();
  runtimeStatus.connectedAt = null;
  runtimeStatus.lastReceivedAt = null;
  runtimeStatus.lastIngestedAt = null;
  runtimeStatus.lastLine = null;
  runtimeStatus.lastPayload = null;
  runtimeStatus.lastError = null;
  runtimeStatus.signal = {
    rssi: null,
    snr: null,
    sequence: null,
    quality: "unknown",
    lastUpdatedAt: null,
  };
  runtimeStatus.ingestedCount = 0;
  runtimeStatus.ignoredCount = 0;
};

const closeActivePort = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (port) {
    const currentPort = port;
    port = null;
    currentPort.close();
  }

  runtimeStatus.connected = false;
  runtimeStatus.reconnecting = false;
};

const buildRequiredOptions = (
  options: SerialGatewayConnectOptions,
): Required<SerialGatewayConnectOptions> => ({
  path: options.path.trim(),
  baudRate: options.baudRate ?? DEFAULT_BAUD_RATE,
  sessionId: options.sessionId ?? 0,
  source: options.source?.trim() || "esp32-serial",
  transmitterId: options.transmitterId?.trim() || "",
  reconnectMs: options.reconnectMs ?? DEFAULT_RECONNECT_MS,
  verbose: options.verbose ?? false,
});

const createSerialLineIngestor = (options: Required<SerialGatewayConnectOptions>) => {
  const logIgnoredLine = (message: string) => {
    const now = Date.now();

    runtimeStatus.ignoredCount += 1;

    if (!options.verbose && now - lastIgnoredLineLogAt < 5000) {
      return;
    }

    lastIgnoredLineLogAt = now;
    console.warn(message);
  };

  const ingestSerialLine = async (rawLine: string) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    runtimeStatus.lastReceivedAt = new Date().toISOString();
    runtimeStatus.lastLine = line;

    if (options.verbose) {
      console.log(`[Serial GW] RAW: ${line}`);
    }

    const { metadata, payloadText } = extractSerialParts(line);
    updateSignalStatus(metadata, line);
    const rawPacketLog = await createGatewayRawPacketLog({
      channel: "serial",
      source: options.source,
      ...(options.sessionId > 0 ? { sessionId: options.sessionId } : {}),
      messageType: line.startsWith("STATS|") ? "stats" : "raw",
      rawMessage: line,
      ...(payloadText ? { payload: { payload: payloadText } } : {}),
      sequence: metadata.SEQ ?? null,
      rssi: metadata.RSSI ?? null,
      snr: metadata.SNR ?? null,
    });

    if (!payloadText) {
      logIgnoredLine(`[Serial GW] Signal/status only: ${line}`);
      return;
    }

    runtimeStatus.lastPayload = payloadText;

    const parsedJsonPayload = parseJsonObject(payloadText);
    const wits = parsedJsonPayload ? {} : parseWitsPairs(payloadText);
    const mwdPayload = parsedJsonPayload
      ? parsedJsonPayload
      : parseMwdKeyValuePayload(payloadText);

    if (options.verbose && Object.keys(wits).length > 0) {
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
      gatewaySource: options.source,
    };

    if (options.transmitterId) {
      gatewayPayload.gatewayTransmitter = options.transmitterId;
    }

    if (options.sessionId > 0 && gatewayPayload.sessionId === undefined) {
      gatewayPayload.sessionId = options.sessionId;
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
      const result = await submitGatewayCandidate({
        channel: "serial",
        source: options.source,
        payload: gatewayPayload,
        ...(rawPacketLog ? { rawPacketLogId: rawPacketLog.id } : {}),
      });

      if (result.selected) {
        runtimeStatus.ingestedCount += result.createdItems.length;
        runtimeStatus.lastIngestedAt = new Date().toISOString();
        runtimeStatus.lastError = null;
        console.log(
          `[Serial GW] Selected ${result.createdItems.length} MWD row(s) from ${options.path}: ${payloadText}`,
        );
      } else {
        runtimeStatus.ignoredCount += 1;
        console.log(`[Serial GW] Candidate skipped: ${result.reason}.`);
      }
    } catch (error: unknown) {
      if (error instanceof GatewayIngestError) {
        runtimeStatus.lastError = error.message;
        console.warn(`[Serial GW] Ingest rejected: ${error.message}`);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unknown ingest error";
      runtimeStatus.lastError = message;
      console.error(`[Serial GW] Ingest failed: ${message}`);
    }
  };

  const ingestSerialWitsBlock = async (block: ParsedSerialWitsBlock) => {
    runtimeStatus.lastReceivedAt = new Date().toISOString();
    runtimeStatus.lastLine = block.rawBlock;
    runtimeStatus.lastPayload = block.rawBlock;

    if (options.verbose) {
      console.log(`[Serial GW] RAW WITS block:\n${block.rawBlock}`);
    }

    if (Object.keys(block.values).length === 0) {
      logIgnoredLine("[Serial GW] Ignored WITS block without valid WITS lines.");
      return;
    }

    const depthFromWits = getLatestDepthFromWits(block.values);

    if (depthFromWits !== null) {
      latestDepthMd = depthFromWits;
    }

    const gatewayPayload: Record<string, unknown> = {
      measuredAt: new Date().toISOString(),
      gatewaySource: options.source,
      wits: block.values,
      rawWitsBlock: block.rawBlock,
      raw: block.rawBlock,
      serialWitsLines: block.lines.map((line) => ({
        rawLine: line.rawLine,
        witsId: line.witsId,
        rawValue: line.rawValue,
        numericValue: line.numericValue,
        malformed: line.malformed,
        reason: line.reason,
      })),
    };

    if (options.transmitterId) {
      gatewayPayload.gatewayTransmitter = options.transmitterId;
    }

    if (options.sessionId > 0) {
      gatewayPayload.sessionId = options.sessionId;
    }

    if (runtimeStatus.signal.sequence !== null) {
      gatewayPayload.gatewaySequence = runtimeStatus.signal.sequence;
    }

    if (runtimeStatus.signal.rssi !== null) {
      gatewayPayload.gatewayRssi = runtimeStatus.signal.rssi;
    }

    if (runtimeStatus.signal.snr !== null) {
      gatewayPayload.gatewaySnr = runtimeStatus.signal.snr;
    }

    if (gatewayPayload.depthMd === undefined && latestDepthMd !== null) {
      gatewayPayload.depthMd = latestDepthMd;
    }

    try {
      const rawPacketLog = await createGatewayRawPacketLog({
        channel: "serial",
        source: options.source,
        ...(options.sessionId > 0 ? { sessionId: options.sessionId } : {}),
        messageType: "wits-block",
        rawMessage: block.rawBlock,
        payload: { wits: block.values },
        sequence: runtimeStatus.signal.sequence,
        rssi: runtimeStatus.signal.rssi,
        snr: runtimeStatus.signal.snr,
      });
      const result = await submitGatewayCandidate({
        channel: "serial",
        source: options.source,
        payload: gatewayPayload,
        ...(rawPacketLog ? { rawPacketLogId: rawPacketLog.id } : {}),
      });

      if (result.selected) {
        runtimeStatus.ingestedCount += result.createdItems.length;
        runtimeStatus.lastIngestedAt = new Date().toISOString();
        runtimeStatus.lastError = null;
        console.log(
          `[Serial GW] Selected ${result.createdItems.length} MWD row(s) from ${options.path}: WITS ${Object.keys(block.values).join(", ")}`,
        );
      } else {
        runtimeStatus.ignoredCount += 1;
        console.log(`[Serial GW] Candidate skipped: ${result.reason}.`);
      }
    } catch (error: unknown) {
      if (error instanceof GatewayIngestError) {
        runtimeStatus.lastError = error.message;
        console.warn(`[Serial GW] Ingest rejected: ${error.message}`);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unknown ingest error";
      runtimeStatus.lastError = message;
      console.error(`[Serial GW] Ingest failed: ${message}`);
    }
  };

  return {
    ingestSerialLine,
    ingestSerialWitsBlock,
  };
};

const openSerialConnection = async () => {
  if (stopped || !activeOptions) {
    return;
  }

  const SerialPortClass = await loadSerialPortClass();

  if (!SerialPortClass) {
    return;
  }

  const options = activeOptions;
  const { ingestSerialLine, ingestSerialWitsBlock } = createSerialLineIngestor(options);

  const handleSerialData = (data: unknown) => {
    void normalizeChunk(data).then((chunk) => {
      const parsedStream = witsStreamParser.push(chunk);

      for (const line of parsedStream.standaloneLines) {
        void ingestSerialLine(line);
      }

      for (const block of parsedStream.blocks) {
        void ingestSerialWitsBlock(block);
      }
    });
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) {
      return;
    }

    runtimeStatus.connected = false;
    runtimeStatus.reconnecting = true;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void openSerialConnection();
    }, options.reconnectMs);
    reconnectTimer.unref();
  };

  console.log(`[Serial GW] Opening ${options.path} @ ${options.baudRate}`);
  port = new SerialPortClass({
    path: options.path,
    baudRate: options.baudRate,
    autoOpen: false,
  }) as unknown as SerialPortInstance;

  port.on("open", () => {
    runtimeStatus.connected = true;
    runtimeStatus.reconnecting = false;
    runtimeStatus.connectedAt = new Date().toISOString();
    runtimeStatus.lastError = null;
    console.log(`[Serial GW] Connected to ${options.path}`);
    void recordConnectionStatus(
      options.source,
      "connected",
      `Serial connected to ${options.path} @ ${options.baudRate}`,
    );
  });

  port.on("data", handleSerialData);

  port.on("error", (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown serial error";
    runtimeStatus.lastError = message;
    console.warn(`[Serial GW] Error on ${options.path}: ${message}`);
    void recordConnectionStatus(options.source, "degraded", message);
  });

  port.on("close", () => {
    console.warn(`[Serial GW] Closed ${options.path}`);
    runtimeStatus.connected = false;
    void recordConnectionStatus(
      options.source,
      "offline",
      `Serial closed ${options.path}`,
    );
    port = null;
    scheduleReconnect();
  });

  port.open((error) => {
    if (!error) {
      return;
    }

    const message = error.message || "Unknown serial open error";
    runtimeStatus.lastError = message;
    console.warn(`[Serial GW] Failed to open ${options.path}: ${message}`);
    void recordConnectionStatus(options.source, "offline", message);
    port = null;
    scheduleReconnect();
  });
};

export const connectSerialGateway = async (
  options: SerialGatewayConnectOptions,
) => {
  const requiredOptions = buildRequiredOptions(options);

  if (!requiredOptions.path) {
    throw new Error("Serial path is required");
  }

  if (!Number.isInteger(requiredOptions.baudRate) || requiredOptions.baudRate <= 0) {
    throw new Error("baudRate must be a positive integer");
  }

  stopped = true;
  closeActivePort();

  activeOptions = requiredOptions;
  stopped = false;
  witsStreamParser = new SerialWitsStreamParser(MAX_BUFFER_LENGTH);
  latestDepthMd = null;
  resetRuntimeStatusForConnect(requiredOptions);

  await openSerialConnection();
  return getSerialGatewayStatus();
};

export const disconnectSerialGateway = async () => {
  stopped = true;
  closeActivePort();
  activeOptions = null;
  runtimeStatus.enabled = false;
  runtimeStatus.path = null;
  runtimeStatus.baudRate = null;
  runtimeStatus.sessionId = null;
  runtimeStatus.transmitterId = null;
  runtimeStatus.connectedAt = null;

  if (runtimeStatus.source) {
    await recordConnectionStatus(
      runtimeStatus.source,
      "offline",
      "Serial gateway disconnected manually",
    );
  }

  return getSerialGatewayStatus();
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
  const transmitterId = process.env.SERIAL_GATEWAY_TRANSMITTER_ID?.trim();

  if (defaultSessionId === null) {
    console.warn(
      "[Serial GW] SERIAL_GATEWAY_SESSION_ID is not set. Serial payloads must include sessionId.",
    );
  }

  await connectSerialGateway({
    path: portPath,
    baudRate,
    ...(defaultSessionId !== null ? { sessionId: defaultSessionId } : {}),
    reconnectMs,
    verbose: verboseLogging,
    source,
    ...(transmitterId ? { transmitterId } : {}),
  });

  return () => {
    void disconnectSerialGateway();
  };
};
