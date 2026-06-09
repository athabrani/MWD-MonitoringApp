import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as sessionService from "../services/mwd-session.service.js";
import * as witsDataService from "../services/wits-data.service.js";
import { normalizeWitsId } from "../utils/mwd-measurements.js";
import { canAccessSessionOwner, canViewAllSessions, } from "../utils/roles.js";
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
const toRecord = (value) => typeof value === "object" && value !== null
    ? value
    : {};
const parseOptionalDate = (value, fieldName) => {
    if (value === undefined) {
        return { provided: false, value: undefined };
    }
    if (typeof value !== "string" || !value.trim()) {
        return {
            provided: true,
            error: `${fieldName} must be a valid date`,
        };
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? { provided: true, error: `${fieldName} must be a valid date` }
        : { provided: true, value: date };
};
const parseOptionalNumber = (value, fieldName) => {
    if (value === undefined) {
        return { provided: false, value: undefined };
    }
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
            ? Number(value)
            : NaN;
    return Number.isFinite(parsed)
        ? { provided: true, value: parsed }
        : { provided: true, error: `${fieldName} must be a valid number` };
};
const parseOptionalBoolean = (value, fieldName) => {
    if (value === undefined) {
        return { provided: false, value: undefined };
    }
    if (typeof value === "boolean") {
        return { provided: true, value };
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
            return { provided: true, value: true };
        }
        if (normalized === "false" || normalized === "0") {
            return { provided: true, value: false };
        }
    }
    return {
        provided: true,
        error: `${fieldName} must be true or false`,
    };
};
const parseOptionalWitsId = (value) => {
    if (value === undefined) {
        return { provided: false, value: undefined };
    }
    const witsId = normalizeWitsId(value);
    if (!witsId || !/^\d{4}$/.test(witsId)) {
        return {
            provided: true,
            error: "witsId must be a 4 digit WITS ID",
        };
    }
    return { provided: true, value: witsId };
};
const canAccessSession = (req, sessionUserId) => {
    const user = req.user;
    return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};
const getSessionFilter = async (req, res) => {
    const authUser = req.user;
    const sessionIdParam = req.query.sessionId;
    const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;
    if (!authUser) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    if (sessionIdParam !== undefined && sessionId === null) {
        res.status(400).json({ message: "sessionId must be a positive integer" });
        return null;
    }
    if (sessionId !== null) {
        const session = await sessionService.getSessionById(sessionId);
        if (!session) {
            res.status(404).json({ message: "Session not found" });
            return null;
        }
        if (!canAccessSession(req, session.userId)) {
            res.status(403).json({ message: "Forbidden" });
            return null;
        }
    }
    const filter = {};
    if (sessionId !== null) {
        filter.sessionId = sessionId;
    }
    if (!canViewAllSessions(authUser.roleName)) {
        filter.ownerUserId = authUser.userId;
    }
    return filter;
};
const parseLimit = (value) => {
    if (value === undefined) {
        return undefined;
    }
    const parsed = parsePositiveInt(value);
    return parsed ?? "invalid";
};
const handleWitsDataWriteError = (error, res) => {
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025") {
        return res.status(404).json({ message: "WITS alarm not found" });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
};
export const getWitsDataValues = async (req, res) => {
    try {
        const sessionFilter = await getSessionFilter(req, res);
        if (!sessionFilter) {
            return;
        }
        const witsId = parseOptionalWitsId(req.query.witsId);
        const measuredFrom = parseOptionalDate(req.query.measuredFrom, "measuredFrom");
        const measuredTo = parseOptionalDate(req.query.measuredTo, "measuredTo");
        const depthMin = parseOptionalNumber(req.query.depthMin, "depthMin");
        const depthMax = parseOptionalNumber(req.query.depthMax, "depthMax");
        const limit = parseLimit(req.query.limit);
        for (const parsed of [witsId, measuredFrom, measuredTo, depthMin, depthMax]) {
            if ("error" in parsed) {
                return res.status(400).json({ message: parsed.error });
            }
        }
        if (limit === "invalid") {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        const filters = {
            ...sessionFilter,
            ...(witsId.provided ? { witsId: witsId.value } : {}),
            ...(measuredFrom.provided ? { measuredFrom: measuredFrom.value } : {}),
            ...(measuredTo.provided ? { measuredTo: measuredTo.value } : {}),
            ...(depthMin.provided ? { depthMin: depthMin.value } : {}),
            ...(depthMax.provided ? { depthMax: depthMax.value } : {}),
            ...(limit !== undefined ? { limit } : {}),
        };
        const data = await witsDataService.getWitsDataValues(filters);
        res.json({
            filters,
            count: data.length,
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getWitsAlarmEvents = async (req, res) => {
    try {
        const sessionFilter = await getSessionFilter(req, res);
        if (!sessionFilter) {
            return;
        }
        const witsId = parseOptionalWitsId(req.query.witsId);
        const acknowledged = parseOptionalBoolean(req.query.acknowledged, "acknowledged");
        const limit = parseLimit(req.query.limit);
        for (const parsed of [witsId, acknowledged]) {
            if ("error" in parsed) {
                return res.status(400).json({ message: parsed.error });
            }
        }
        if (limit === "invalid") {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        const filters = {
            ...sessionFilter,
            ...(witsId.provided ? { witsId: witsId.value } : {}),
            ...(acknowledged.provided ? { acknowledged: acknowledged.value } : {}),
            ...(limit !== undefined ? { limit } : {}),
        };
        const data = await witsDataService.getWitsAlarmEvents(filters);
        res.json({
            filters,
            count: data.length,
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const acknowledgeWitsAlarm = async (req, res) => {
    try {
        const authUser = req.user;
        const id = parsePositiveBigInt(req.params.id);
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (id === null) {
            return res.status(400).json({ message: "Invalid WITS alarm id" });
        }
        const alarm = await witsDataService.acknowledgeWitsAlarm(id, authUser.userId);
        const alarmRecord = toRecord(alarm);
        await createAuditLog({
            userId: authUser.userId,
            action: "wits_alarm.acknowledge",
            details: `Acknowledged WITS alarm ${id.toString()}`,
            metadata: {
                alarmId: id.toString(),
                witsId: alarmRecord.witsId !== undefined ? String(alarmRecord.witsId) : null,
                sessionId: alarmRecord.sessionId !== undefined
                    ? String(alarmRecord.sessionId)
                    : null,
            },
        });
        res.json(alarm);
    }
    catch (error) {
        return handleWitsDataWriteError(error, res);
    }
};
export const resolveWitsAlarm = async (req, res) => {
    try {
        const id = parsePositiveBigInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid WITS alarm id" });
        }
        const alarm = await witsDataService.resolveWitsAlarm(id);
        const authUser = req.user;
        const alarmRecord = toRecord(alarm);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "wits_alarm.resolve",
            details: `Resolved WITS alarm ${id.toString()}`,
            metadata: {
                alarmId: id.toString(),
                witsId: alarmRecord.witsId !== undefined ? String(alarmRecord.witsId) : null,
                sessionId: alarmRecord.sessionId !== undefined
                    ? String(alarmRecord.sessionId)
                    : null,
            },
        });
        res.json(alarm);
    }
    catch (error) {
        return handleWitsDataWriteError(error, res);
    }
};
//# sourceMappingURL=wits-data.controller.js.map