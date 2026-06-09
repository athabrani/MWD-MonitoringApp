import { prisma } from "../lib/prisma.js";
import * as mwdDataService from "./mwd-data.service.js";
import * as sessionService from "./mwd-session.service.js";
import { applyMeasurementFields, parseMeasurementFields, } from "../utils/mwd-measurements.js";
import { buildDepthTrackingInputFromMwdSource, updateDepthTrackingState, } from "./depth-tracking.service.js";
import { syncTimestampAndDepth } from "../utils/timestamp-depth-sync.js";
import { recordConfiguredWitsValues } from "./wits-data.service.js";
const DEDUP_TTL_MS = 30_000;
const DEDUP_FALLBACK_TTL_MS = 2_000;
const MAX_DEDUP_CACHE_SIZE = 1000;
const recentGatewayPackets = new Map();
export class GatewayIngestError extends Error {
    statusCode;
    constructor(message, statusCode = 500) {
        super(message);
        this.name = "GatewayIngestError";
        this.statusCode = statusCode;
    }
}
const parsePositiveInt = (value) => {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
};
const parseOptionalDateInput = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string" || !value.trim()) {
        return "invalid";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "invalid" : date;
};
const toNumericDepth = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && value !== null && "toString" in value) {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const getDepthBasis = (parsedFields) => {
    const fields = parsedFields;
    return fields.depthMd?.value ?? fields.hole_depth?.value ?? null;
};
const isNewDepthSnapshot = (latestDepth, currentDepth) => {
    const latest = toNumericDepth(latestDepth);
    const current = toNumericDepth(currentDepth);
    if (current === null) {
        return false;
    }
    if (latest === null) {
        return true;
    }
    return current > latest;
};
const parseOptionalText = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : undefined;
};
const isRecord = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};
const normalizeWitsSignature = (source) => {
    if (!isRecord(source)) {
        return "";
    }
    return Object.entries(source)
        .map(([key, value]) => [key.trim(), String(value).trim()])
        .filter(([key, value]) => /^\d{4}$/.test(key) && value !== "")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("|");
};
const normalizeMeasurementSignature = (parsedFields) => {
    return Object.entries(parsedFields)
        .map(([key, field]) => [key, field?.value])
        .filter(([, value]) => value !== undefined && value !== null)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("|");
};
const cleanupDedupCache = (now) => {
    if (recentGatewayPackets.size <= MAX_DEDUP_CACHE_SIZE) {
        return;
    }
    for (const [key, timestamp] of recentGatewayPackets.entries()) {
        if (now - timestamp > DEDUP_TTL_MS) {
            recentGatewayPackets.delete(key);
        }
        if (recentGatewayPackets.size <= MAX_DEDUP_CACHE_SIZE) {
            break;
        }
    }
};
const getGatewayDedupInfo = (sessionId, payload, measurementSignature) => {
    const gatewaySequence = parseOptionalText(payload.gatewaySequence ?? payload.sequence ?? payload.seq);
    const gatewayTransmitter = parseOptionalText(payload.gatewayTransmitter ??
        payload.transmitterId ??
        payload.deviceId ??
        payload.gatewayDeviceId);
    const witsSignature = normalizeWitsSignature(payload.wits);
    const payloadSignature = witsSignature || measurementSignature;
    if (!payloadSignature) {
        return null;
    }
    if (gatewaySequence) {
        return {
            key: [
                "seq",
                sessionId,
                gatewayTransmitter ?? "default-transmitter",
                gatewaySequence,
                payloadSignature,
            ].join("|"),
            ttlMs: DEDUP_TTL_MS,
        };
    }
    return {
        key: [
            "payload-window",
            sessionId,
            gatewayTransmitter ?? "default-transmitter",
            payloadSignature,
        ].join("|"),
        ttlMs: DEDUP_FALLBACK_TTL_MS,
    };
};
const isDuplicateGatewayPayload = (sessionId, payload, measurementSignature) => {
    const dedupInfo = getGatewayDedupInfo(sessionId, payload, measurementSignature);
    if (!dedupInfo) {
        return false;
    }
    const now = Date.now();
    const previousTimestamp = recentGatewayPackets.get(dedupInfo.key);
    cleanupDedupCache(now);
    if (previousTimestamp !== undefined &&
        now - previousTimestamp <= dedupInfo.ttlMs) {
        return true;
    }
    recentGatewayPackets.set(dedupInfo.key, now);
    return false;
};
const normalizeGatewayPayloads = (rawPayload) => {
    const payloads = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    if (!payloads.length ||
        typeof payloads[0] !== "object" ||
        payloads[0] === null ||
        Array.isArray(payloads[0])) {
        throw new GatewayIngestError("Request body must contain MWD data payload", 400);
    }
    return payloads;
};
export const ingestGatewayPayloads = async (rawPayload) => {
    const payloads = normalizeGatewayPayloads(rawPayload);
    const depthTrackingInputs = [];
    const items = await prisma.$transaction(async (tx) => {
        const items = [];
        for (const [index, payload] of payloads.entries()) {
            const sessionId = parsePositiveInt(payload.sessionId);
            const measuredAt = parseOptionalDateInput(payload.measuredAt);
            if (sessionId === null) {
                throw new GatewayIngestError(`Payload at index ${index} has invalid sessionId`, 400);
            }
            if (measuredAt === "invalid") {
                throw new GatewayIngestError(`Payload at index ${index} has invalid measuredAt`, 400);
            }
            const session = await sessionService.getSessionById(sessionId);
            if (!session) {
                throw new GatewayIngestError(`Session not found for payload at index ${index}`, 404);
            }
            const measurementResult = parseMeasurementFields(payload);
            if ("error" in measurementResult) {
                throw new GatewayIngestError(`Payload at index ${index}: ${measurementResult.error}`, 400);
            }
            const measurementSignature = normalizeMeasurementSignature(measurementResult.parsedFields);
            if (isDuplicateGatewayPayload(sessionId, payload, measurementSignature)) {
                console.log(`[Gateway Ingest] Duplicate payload skipped for session ${sessionId}.`);
                continue;
            }
            const depthBasis = getDepthBasis(measurementResult.parsedFields);
            const { measuredAt: syncedMeasuredAt, syncInfo } = await syncTimestampAndDepth({
                sessionId,
                ...(measuredAt !== undefined ? { measuredAt } : {}),
                depthMd: depthBasis,
            }, tx);
            depthTrackingInputs.push(buildDepthTrackingInputFromMwdSource({
                sessionId,
                measuredAt: syncedMeasuredAt,
                source: payload,
            }));
            const witsInfo = await recordConfiguredWitsValues({
                sessionId,
                measuredAt: syncedMeasuredAt,
                depthMd: depthBasis,
                source: payload,
            }, tx);
            if (!isNewDepthSnapshot(syncInfo.latestDepthMd, depthBasis)) {
                console.log(`[Gateway Ingest] Depth did not advance for session ${sessionId}; storing row for time-series data.`);
            }
            const input = {
                sessionId,
                measuredAt: syncedMeasuredAt,
            };
            applyMeasurementFields(input, measurementResult.parsedFields);
            const createdItem = await mwdDataService.createMWDData(input, tx);
            items.push({
                ...createdItem,
                syncInfo,
                witsInfo: {
                    configuredCount: witsInfo.configuredCount,
                    loggedCount: witsInfo.loggedCount,
                    alarmCount: witsInfo.alarmCount,
                    skippedInvalid: witsInfo.skippedInvalid,
                },
            });
        }
        return items;
    });
    for (const depthTrackingInput of depthTrackingInputs) {
        try {
            await updateDepthTrackingState(depthTrackingInput);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown depth tracking error";
            console.warn(`[Gateway Ingest] Depth tracking update failed: ${message}`);
        }
    }
    return items;
};
//# sourceMappingURL=gateway-ingest.service.js.map