import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as mwdDataService from "../services/mwd-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import { applyMeasurementFields, parseMeasurementFields, } from "../utils/mwd-measurements.js";
import { canAccessSessionOwner, canModifyMonitoringData, canViewAllSessions, } from "../utils/roles.js";
import { syncTimestampAndDepth } from "../utils/timestamp-depth-sync.js";
import { recordConfiguredWitsValues } from "../services/wits-data.service.js";
import { buildDepthTrackingInputFromMwdSource, updateDepthTrackingState, } from "../services/depth-tracking.service.js";
import { createAuditLog } from "../services/audit-log.service.js";
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
const parsePositiveBigInt = (value) => {
    if (typeof value === "bigint" && value > 0n) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        try {
            const parsed = BigInt(value);
            return parsed > 0n ? parsed : null;
        }
        catch {
            return null;
        }
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
const canAccessSession = (req, sessionUserId) => {
    const user = req.user;
    return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};
const handleMWDDataWriteError = (error, res) => {
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2003") {
        return res.status(400).json({ message: "Session not found" });
    }
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025") {
        return res.status(404).json({ message: "MWD data not found" });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
};
export const createMWDData = async (req, res) => {
    try {
        const authUser = req.user;
        const sessionId = parsePositiveInt(req.body?.sessionId);
        const measuredAt = parseOptionalDateInput(req.body?.measuredAt);
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!canModifyMonitoringData(authUser.roleName)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (sessionId === null) {
            return res.status(400).json({ message: "Valid sessionId is required" });
        }
        if (measuredAt === "invalid") {
            return res.status(400).json({ message: "measuredAt must be a valid date" });
        }
        const session = await sessionService.getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        if (!canAccessSession(req, session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const measurementResult = parseMeasurementFields(req.body ?? {});
        if ("error" in measurementResult) {
            return res.status(400).json({ message: measurementResult.error });
        }
        const { measuredAt: syncedMeasuredAt, syncInfo } = await syncTimestampAndDepth({
            sessionId,
            ...(measuredAt !== undefined ? { measuredAt } : {}),
            depthMd: measurementResult.parsedFields.depthMd.value ?? null,
        });
        const input = {
            sessionId,
            measuredAt: syncedMeasuredAt,
        };
        applyMeasurementFields(input, measurementResult.parsedFields);
        const data = await mwdDataService.createMWDData(input);
        const witsInfo = await recordConfiguredWitsValues({
            sessionId,
            measuredAt: syncedMeasuredAt,
            depthMd: measurementResult.parsedFields.depthMd.value ?? null,
            source: req.body ?? {},
        });
        const depthTrackingInfo = await updateDepthTrackingState(buildDepthTrackingInputFromMwdSource({
            sessionId,
            measuredAt: syncedMeasuredAt,
            source: req.body ?? {},
        }));
        await createAuditLog({
            userId: authUser.userId,
            action: "mwd_data.create",
            details: `Created MWD data for session ${sessionId}`,
            metadata: {
                mwdDataId: data.id.toString(),
                sessionId,
                depthMd: data.depthMd?.toString() ?? null,
                measuredAt: data.measuredAt.toISOString(),
            },
        });
        res.status(201).json({
            ...data,
            syncInfo,
            depthTrackingInfo,
            witsInfo: {
                configuredCount: witsInfo.configuredCount,
                loggedCount: witsInfo.loggedCount,
                alarmCount: witsInfo.alarmCount,
                skippedInvalid: witsInfo.skippedInvalid,
                outputQueuedCount: witsInfo.outputQueuedCount,
                outputSkippedCount: witsInfo.outputSkippedCount,
            },
        });
    }
    catch (error) {
        return handleMWDDataWriteError(error, res);
    }
};
export const getAllMWDData = async (req, res) => {
    try {
        const sessionIdParam = req.query.sessionId;
        const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;
        const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
        if (sessionIdParam !== undefined && sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        if (sessionId !== null) {
            const session = await sessionService.getSessionById(sessionId);
            if (!session) {
                return res.status(404).json({ message: "Session not found" });
            }
            if (!canAccessSession(req, session.userId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const authUser = req.user;
        const allData = await mwdDataService.getAllMWDData(sessionId ?? undefined, {
            includeHidden,
        });
        const filteredData = authUser && canViewAllSessions(authUser.roleName)
            ? allData
            : allData.filter((item) => item.session.userId === authUser?.userId);
        res.json(filteredData);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getMWDDataById = async (req, res) => {
    try {
        const idParam = req.params.id;
        const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;
        if (id === null) {
            return res.status(400).json({ message: "Invalid MWD data id" });
        }
        const data = await mwdDataService.getMWDDataById(id);
        if (!data) {
            return res.status(404).json({ message: "MWD data not found" });
        }
        if (!canAccessSession(req, data.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(data);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const updateMWDData = async (req, res) => {
    try {
        const authUser = req.user;
        const idParam = req.params.id;
        const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!canModifyMonitoringData(authUser.roleName)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (id === null) {
            return res.status(400).json({ message: "Invalid MWD data id" });
        }
        const existingData = await mwdDataService.getMWDDataById(id);
        if (!existingData) {
            return res.status(404).json({ message: "MWD data not found" });
        }
        if (!canAccessSession(req, existingData.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const updates = {};
        if (req.body?.sessionId !== undefined) {
            const sessionId = parsePositiveInt(req.body.sessionId);
            if (sessionId === null) {
                return res.status(400).json({ message: "Valid sessionId is required" });
            }
            const session = await sessionService.getSessionById(sessionId);
            if (!session) {
                return res.status(404).json({ message: "Session not found" });
            }
            if (!canAccessSession(req, session.userId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            updates.sessionId = sessionId;
        }
        if (req.body?.measuredAt !== undefined) {
            const measuredAt = parseOptionalDateInput(req.body.measuredAt);
            if (measuredAt === "invalid" || measuredAt === undefined) {
                return res.status(400).json({ message: "measuredAt must be a valid date" });
            }
            updates.measuredAt = measuredAt;
        }
        const measurementResult = parseMeasurementFields(req.body ?? {});
        if ("error" in measurementResult) {
            return res.status(400).json({ message: measurementResult.error });
        }
        applyMeasurementFields(updates, measurementResult.parsedFields);
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const targetSessionId = updates.sessionId ?? existingData.sessionId;
        const targetMeasuredAt = updates.measuredAt ?? existingData.measuredAt;
        const targetDepthMd = updates.depthMd !== undefined ? updates.depthMd : existingData.depthMd;
        if (updates.sessionId !== undefined ||
            updates.measuredAt !== undefined ||
            updates.depthMd !== undefined) {
            const syncInput = {
                sessionId: targetSessionId,
                ...(targetMeasuredAt !== null ? { measuredAt: targetMeasuredAt } : {}),
                depthMd: targetDepthMd,
                excludeId: id,
            };
            const { measuredAt: syncedMeasuredAt } = await syncTimestampAndDepth(syncInput);
            updates.measuredAt = syncedMeasuredAt;
        }
        const data = await mwdDataService.updateMWDData(id, updates);
        await createAuditLog({
            userId: authUser.userId,
            action: "mwd_data.update",
            details: `Updated MWD data ${id.toString()}`,
            metadata: {
                mwdDataId: id.toString(),
                sessionId: data.sessionId,
                updatedFields: Object.keys(updates),
            },
        });
        res.json(data);
    }
    catch (error) {
        return handleMWDDataWriteError(error, res);
    }
};
export const deleteMWDData = async (req, res) => {
    try {
        const idParam = req.params.id;
        const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;
        if (id === null) {
            return res.status(400).json({ message: "Invalid MWD data id" });
        }
        const existingData = await mwdDataService.getMWDDataById(id);
        if (!existingData) {
            return res.status(404).json({ message: "MWD data not found" });
        }
        if (!canAccessSession(req, existingData.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const deletedData = await mwdDataService.deleteMWDData(id);
        const authUser = req.user;
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "mwd_data.delete",
            details: `Deleted MWD data ${id.toString()}`,
            metadata: {
                mwdDataId: id.toString(),
                sessionId: deletedData.sessionId,
                depthMd: deletedData.depthMd?.toString() ?? null,
            },
        });
        res.json({ message: "MWD data deleted successfully" });
    }
    catch (error) {
        return handleMWDDataWriteError(error, res);
    }
};
//# sourceMappingURL=mwd-data.controller.js.map