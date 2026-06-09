import * as historicalDataService from "../services/historical-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import { canAccessSessionOwner, canViewAllSessions } from "../utils/roles.js";
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
const parsePositiveNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    return null;
};
const parseOptionalDate = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        return "invalid";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "invalid" : date;
};
export const getHistoricalData = async (req, res) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const sessionIdParam = req.query.sessionId;
        const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;
        if (sessionIdParam !== undefined && sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        const measuredFrom = parseOptionalDate(req.query.measuredFrom);
        const measuredTo = parseOptionalDate(req.query.measuredTo);
        if (measuredFrom === "invalid") {
            return res.status(400).json({ message: "measuredFrom must be a valid date" });
        }
        if (measuredTo === "invalid") {
            return res.status(400).json({ message: "measuredTo must be a valid date" });
        }
        const depthMinParam = req.query.depthMin;
        const depthMaxParam = req.query.depthMax;
        const limitParam = req.query.limit;
        const depthMin = typeof depthMinParam === "string" ? parsePositiveNumber(depthMinParam) : null;
        const depthMax = typeof depthMaxParam === "string" ? parsePositiveNumber(depthMaxParam) : null;
        const limit = typeof limitParam === "string" ? parsePositiveInt(limitParam) : null;
        if (depthMinParam !== undefined && depthMin === null) {
            return res.status(400).json({ message: "depthMin must be a non-negative number" });
        }
        if (depthMaxParam !== undefined && depthMax === null) {
            return res.status(400).json({ message: "depthMax must be a non-negative number" });
        }
        if (limitParam !== undefined && limit === null) {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        if (sessionId !== null) {
            const session = await sessionService.getSessionById(sessionId);
            if (!session) {
                return res.status(404).json({ message: "Session not found" });
            }
            if (!canAccessSessionOwner(authUser.roleName, authUser.userId, session.userId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const sessionIds = canViewAllSessions(authUser.roleName)
            ? undefined
            : (await sessionService.getAllSessions(authUser.userId)).map((session) => session.id);
        const query = {};
        if (sessionId !== null) {
            query.sessionId = sessionId;
        }
        if (sessionIds !== undefined) {
            query.sessionIds = sessionIds;
        }
        if (measuredFrom !== undefined) {
            query.measuredFrom = measuredFrom;
        }
        if (measuredTo !== undefined) {
            query.measuredTo = measuredTo;
        }
        if (depthMin !== null) {
            query.depthMin = depthMin;
        }
        if (depthMax !== null) {
            query.depthMax = depthMax;
        }
        if (limit !== null) {
            query.limit = limit;
        }
        const historicalData = await historicalDataService.getHistoricalData(query);
        res.json({
            filters: {
                sessionId: sessionId ?? null,
                measuredFrom: measuredFrom ?? null,
                measuredTo: measuredTo ?? null,
                depthMin: depthMin ?? null,
                depthMax: depthMax ?? null,
                limit: limit ?? null,
            },
            ...historicalData,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
//# sourceMappingURL=historical-data.controller.js.map