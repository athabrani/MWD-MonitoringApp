import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { broadcastGatewayRawPacket } from "./websocket.service.js";

type RawPacketPayload = Record<string, unknown>;

export type GatewayRawPacketChannel = "websocket" | "serial";

export type CreateGatewayRawPacketLogInput = {
  sessionId?: number | null;
  channel: GatewayRawPacketChannel;
  source: string;
  messageType?: string | null;
  rawMessage: string;
  payload?: RawPacketPayload | null;
  sequence?: string | null;
  rssi?: number | string | null;
  snr?: number | string | null;
  receivedAt?: Date;
  reason?: string | null;
};

export type ListGatewayRawPacketLogsQuery = {
  sessionId?: number;
  channel?: string;
  source?: string;
  messageType?: string;
  selectedByFusion?: boolean;
  ingested?: boolean;
  limit?: number;
  beforeId?: bigint;
};

const gatewayRawPacketLogSelect = {
  id: true,
  sessionId: true,
  channel: true,
  source: true,
  messageType: true,
  rawMessage: true,
  payload: true,
  sequence: true,
  rssi: true,
  snr: true,
  receivedAt: true,
  ingested: true,
  selectedByFusion: true,
  reason: true,
  createdAt: true,
} as const;

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

const parseDecimalInput = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/[-+]?\d+(?:\.\d+)?/);
    const parsed = match?.[0] ? Number(match[0]) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseSessionId = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

export const isGatewayRawPacketLoggingEnabled = () => {
  return parseBoolean(process.env.GATEWAY_RAW_PACKET_LOG_ENABLED, true);
};

export const createGatewayRawPacketLog = async (
  input: CreateGatewayRawPacketLogInput,
) => {
  if (!isGatewayRawPacketLoggingEnabled()) {
    return null;
  }

  const rssi = parseDecimalInput(input.rssi);
  const snr = parseDecimalInput(input.snr);
  const data: Prisma.GatewayRawPacketLogUncheckedCreateInput = {
    channel: input.channel,
    source: input.source,
    rawMessage: input.rawMessage,
  };

  if (input.sessionId) data.sessionId = input.sessionId;
  if (input.messageType) data.messageType = input.messageType;
  if (input.payload) data.payload = input.payload as Prisma.InputJsonValue;
  if (input.sequence) data.sequence = input.sequence;
  if (rssi !== null) data.rssi = rssi;
  if (snr !== null) data.snr = snr;
  if (input.receivedAt) data.receivedAt = input.receivedAt;
  if (input.reason) data.reason = input.reason;

  const created = await prisma.gatewayRawPacketLog.create({
    data,
    select: gatewayRawPacketLogSelect,
  });

  broadcastGatewayRawPacket(created);
  return created;
};

export const markGatewayRawPacketFusionResult = async (
  id: bigint,
  input: {
    selectedByFusion: boolean;
    ingested: boolean;
    reason?: string | null;
  },
) => {
  const updated = await prisma.gatewayRawPacketLog.update({
    where: { id },
    data: {
      selectedByFusion: input.selectedByFusion,
      ingested: input.ingested,
      reason: input.reason ?? null,
    },
    select: gatewayRawPacketLogSelect,
  });

  broadcastGatewayRawPacket(updated);
  return updated;
};

export const listGatewayRawPacketLogs = async (
  query: ListGatewayRawPacketLogsQuery,
) => {
  const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
  const where: {
    sessionId?: number;
    channel?: string;
    source?: string;
    messageType?: string;
    selectedByFusion?: boolean;
    ingested?: boolean;
    id?: { lt: bigint };
  } = {};

  if (query.sessionId !== undefined) {
    where.sessionId = query.sessionId;
  }

  if (query.channel) {
    where.channel = query.channel;
  }

  if (query.source) {
    where.source = query.source;
  }

  if (query.messageType) {
    where.messageType = query.messageType;
  }

  if (query.selectedByFusion !== undefined) {
    where.selectedByFusion = query.selectedByFusion;
  }

  if (query.ingested !== undefined) {
    where.ingested = query.ingested;
  }

  if (query.beforeId !== undefined) {
    where.id = { lt: query.beforeId };
  }

  return prisma.gatewayRawPacketLog.findMany({
    where,
    take,
    orderBy: [{ id: "desc" }],
    select: gatewayRawPacketLogSelect,
  });
};

export const getGatewayRawPacketLogById = async (id: bigint) => {
  return prisma.gatewayRawPacketLog.findUnique({
    where: { id },
    select: gatewayRawPacketLogSelect,
  });
};

export const parseGatewayRawPacketSessionId = parseSessionId;
