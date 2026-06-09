import * as auditLogService from "../services/audit-log.service.js";
const parsePositiveInt = (value) => {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
};
const parsePositiveBigInt = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }
    try {
        const parsed = BigInt(value);
        return parsed > 0n ? parsed : null;
    }
    catch {
        return null;
    }
};
const normalizeOptionalString = (value) => {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
};
export const listAuditLogs = async (req, res) => {
    try {
        const userId = req.query.userId !== undefined
            ? parsePositiveInt(req.query.userId)
            : undefined;
        const limit = req.query.limit !== undefined
            ? parsePositiveInt(req.query.limit)
            : undefined;
        const beforeId = req.query.beforeId !== undefined
            ? parsePositiveBigInt(String(req.query.beforeId))
            : undefined;
        if (req.query.userId !== undefined && userId === null) {
            return res.status(400).json({ message: "userId must be a positive integer" });
        }
        if (req.query.limit !== undefined && limit === null) {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        if (req.query.beforeId !== undefined && beforeId === null) {
            return res.status(400).json({ message: "beforeId must be a positive integer" });
        }
        const query = {};
        const action = normalizeOptionalString(req.query.action);
        if (userId !== undefined && userId !== null)
            query.userId = userId;
        if (limit !== undefined && limit !== null)
            query.limit = limit;
        if (beforeId !== undefined && beforeId !== null)
            query.beforeId = beforeId;
        if (action)
            query.action = action;
        const logs = await auditLogService.listAuditLogs(query);
        res.json(logs);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getAuditLogById = async (req, res) => {
    try {
        const id = parsePositiveBigInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid audit log id" });
        }
        const log = await auditLogService.getAuditLogById(id);
        if (!log) {
            return res.status(404).json({ message: "Audit log not found" });
        }
        res.json(log);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
//# sourceMappingURL=audit-log.controller.js.map