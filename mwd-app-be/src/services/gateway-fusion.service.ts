import {
  GatewayIngestError,
  ingestGatewayPayloads,
} from "./gateway-ingest.service.js";
import { markGatewayRawPacketFusionResult } from "./gateway-raw-packet-log.service.js";
import { broadcastMWDData } from "./websocket.service.js";

type GatewayPayload = Record<string, unknown>;

export type GatewayFusionChannel = "websocket" | "serial";

export type GatewayFusionCandidate = {
  channel: GatewayFusionChannel;
  source: string;
  payload: GatewayPayload;
  receivedAt?: Date;
  rawPacketLogId?: bigint;
};

export type GatewayFusionResult = {
  selected: boolean;
  reason: string;
  createdItems: Awaited<ReturnType<typeof ingestGatewayPayloads>>;
  selectedChannel?: GatewayFusionChannel;
};

type PendingCandidate = Omit<GatewayFusionCandidate, "receivedAt"> & {
  receivedAt: Date;
  id: string;
  resolve: (result: GatewayFusionResult) => void;
  reject: (error: unknown) => void;
};

type PendingGroup = {
  key: string;
  candidates: PendingCandidate[];
  timer: NodeJS.Timeout;
};

const DEFAULT_COMPARE_WINDOW_MS = 750;
const MAX_PENDING_GROUPS = 500;
const pendingGroups = new Map<string, PendingGroup>();

const parseBoolean = (value: unknown, fallback = true) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parsePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
};

const parseOptionalText = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : null;
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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeWitsSignature = (source: unknown) => {
  if (!isRecord(source)) {
    return "";
  }

  return Object.entries(source)
    .map(([key, value]) => [key.trim(), String(value).trim()] as const)
    .filter(([key, value]) => /^\d{4}$/.test(key) && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
};

const normalizePayloadSignature = (payload: GatewayPayload) => {
  const witsSignature = normalizeWitsSignature(payload.wits);

  if (witsSignature) {
    return witsSignature;
  }

  return Object.entries(payload)
    .filter(([key, value]) => {
      return (
        !key.toLowerCase().startsWith("gateway") &&
        key !== "measuredAt" &&
        key !== "raw" &&
        key !== "rawWitsBlock" &&
        value !== undefined &&
        value !== null &&
        typeof value !== "object"
      );
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
};

const getCandidateKey = (payload: GatewayPayload) => {
  const sessionId = parseOptionalText(payload.sessionId) ?? "no-session";
  const transmitter =
    parseOptionalText(
      payload.gatewayTransmitter ??
        payload.transmitterId ??
        payload.deviceId ??
        payload.gatewayDeviceId,
    ) ?? "default-transmitter";
  const sequence = parseOptionalText(
    payload.gatewaySequence ?? payload.sequence ?? payload.seq,
  );

  if (sequence) {
    return ["seq", sessionId, transmitter, sequence].join("|");
  }

  const payloadSignature = normalizePayloadSignature(payload);

  if (payloadSignature) {
    return ["payload", sessionId, transmitter, payloadSignature].join("|");
  }

  return [
    "arrival",
    sessionId,
    transmitter,
    Math.floor(Date.now() / getCompareWindowMs()),
  ].join("|");
};

const getCompareWindowMs = () => {
  return parsePositiveNumber(
    process.env.GATEWAY_FUSION_WINDOW_MS,
    DEFAULT_COMPARE_WINDOW_MS,
  );
};

const isFusionEnabled = () => {
  return parseBoolean(process.env.GATEWAY_FUSION_ENABLED, true);
};

const countPayloadFields = (payload: GatewayPayload) => {
  const witsCount = isRecord(payload.wits) ? Object.keys(payload.wits).length : 0;
  const measurementFields = [
    "depthMd",
    "hole_depth",
    "inclination",
    "azimuth",
    "gammaRay",
    "temperature",
    "rop",
    "hookLoad",
    "standpipePressure",
  ].filter((field) => payload[field] !== undefined && payload[field] !== null);

  return witsCount + measurementFields.length;
};

const getSignalScore = (payload: GatewayPayload) => {
  const rssi = parseSignalNumber(payload.gatewayRssi ?? payload.rssi);
  const snr = parseSignalNumber(payload.gatewaySnr ?? payload.snr);
  let score = 0;

  if (rssi !== null) {
    score += Math.max(0, Math.min(40, rssi + 120));
  }

  if (snr !== null) {
    score += Math.max(0, Math.min(30, snr + 10));
  }

  return score;
};

const scoreCandidate = (candidate: PendingCandidate) => {
  return (
    countPayloadFields(candidate.payload) * 100 +
    getSignalScore(candidate.payload) -
    candidate.receivedAt.getTime() / 1_000_000_000_000
  );
};

const pickBestCandidate = (candidates: PendingCandidate[]) => {
  return candidates.reduce((best, candidate) => {
    return scoreCandidate(candidate) > scoreCandidate(best) ? candidate : best;
  });
};

const cleanupPendingGroups = () => {
  if (pendingGroups.size <= MAX_PENDING_GROUPS) {
    return;
  }

  const oldestGroup = pendingGroups.values().next().value as
    | PendingGroup
    | undefined;

  if (!oldestGroup) {
    return;
  }

  clearTimeout(oldestGroup.timer);
  pendingGroups.delete(oldestGroup.key);
  for (const candidate of oldestGroup.candidates) {
    candidate.reject(new Error("Gateway fusion queue overflow"));
  }
};

const ingestSelectedCandidate = async (
  group: PendingGroup,
  selected: PendingCandidate,
) => {
  try {
    const createdItems = await ingestGatewayPayloads(selected.payload);

    for (const item of createdItems) {
      broadcastMWDData({
        source: selected.source,
        selectedChannel: selected.channel,
        ...item,
      });
    }

    console.log(
      `[Gateway Fusion] Selected ${selected.channel} for ${group.key}; candidates=${group.candidates.length}.`,
    );

    for (const candidate of group.candidates) {
      if (candidate.rawPacketLogId !== undefined) {
        void markGatewayRawPacketFusionResult(candidate.rawPacketLogId, {
          selectedByFusion: candidate.id === selected.id,
          ingested: candidate.id === selected.id && createdItems.length > 0,
          reason:
            candidate.id === selected.id
              ? "selected-best-candidate"
              : `superseded-by-${selected.channel}`,
        }).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Unknown raw log update error";
          console.warn(`[Gateway Fusion] Failed to update raw packet log: ${message}`);
        });
      }

      candidate.resolve({
        selected: candidate.id === selected.id,
        reason:
          candidate.id === selected.id
            ? "selected-best-candidate"
            : `superseded-by-${selected.channel}`,
        createdItems: candidate.id === selected.id ? createdItems : [],
        selectedChannel: selected.channel,
      });
    }
  } catch (error: unknown) {
    for (const candidate of group.candidates) {
      candidate.reject(error);
    }
  }
};

const flushGroup = (key: string) => {
  const group = pendingGroups.get(key);

  if (!group) {
    return;
  }

  pendingGroups.delete(key);

  const selected = pickBestCandidate(group.candidates);
  void ingestSelectedCandidate(group, selected);
};

export const submitGatewayCandidate = async (
  candidate: GatewayFusionCandidate,
) => {
  const payload = {
    ...candidate.payload,
    gatewaySource: candidate.payload.gatewaySource ?? candidate.source,
  };
  const normalizedCandidate = {
    ...candidate,
    payload,
    receivedAt: candidate.receivedAt ?? new Date(),
  };

  if (!isFusionEnabled()) {
    const createdItems = await ingestGatewayPayloads(payload);

    if (candidate.rawPacketLogId !== undefined) {
      void markGatewayRawPacketFusionResult(candidate.rawPacketLogId, {
        selectedByFusion: true,
        ingested: createdItems.length > 0,
        reason: "fusion-disabled",
      }).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown raw log update error";
        console.warn(`[Gateway Fusion] Failed to update raw packet log: ${message}`);
      });
    }

    for (const item of createdItems) {
      broadcastMWDData({
        source: candidate.source,
        selectedChannel: candidate.channel,
        ...item,
      });
    }

    return {
      selected: true,
      reason: "fusion-disabled",
      createdItems,
      selectedChannel: candidate.channel,
    } satisfies GatewayFusionResult;
  }

  return new Promise<GatewayFusionResult>((resolve, reject) => {
    const key = getCandidateKey(payload);
    const id = `${normalizedCandidate.channel}-${Date.now()}-${Math.random()}`;
    const pendingCandidate: PendingCandidate = {
      ...normalizedCandidate,
      id,
      resolve,
      reject,
    };
    const existingGroup = pendingGroups.get(key);

    if (existingGroup) {
      existingGroup.candidates.push(pendingCandidate);
      return;
    }

    const timer = setTimeout(() => flushGroup(key), getCompareWindowMs());
    timer.unref();

    pendingGroups.set(key, {
      key,
      candidates: [pendingCandidate],
      timer,
    });
    cleanupPendingGroups();
  }).catch((error: unknown) => {
    if (error instanceof GatewayIngestError) {
      throw error;
    }

    throw error;
  });
};
