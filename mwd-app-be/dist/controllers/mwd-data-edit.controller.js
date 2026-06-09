import * as mwdDataEditService from "../services/mwd-data-edit.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
import { canAccessSessionOwner, canModifyMonitoringData, } from "../utils/roles.js";
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
const parseNonNegativeNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    return null;
};
const parseFiniteNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const parseOptionalBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
            return true;
        }
        if (normalized === "false" || normalized === "0") {
            return false;
        }
    }
    return null;
};
const parseOptionalNote = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    return typeof value === "string" ? value.trim() || null : "invalid";
};
const canAccessSession = (req, sessionUserId) => {
    const user = req.user;
    return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};
const getEditInput = (req) => {
    return (req.method === "GET" ? req.query : req.body ?? {});
};
const parseEditBaseInput = async (req, res) => {
    const authUser = req.user;
    const input = getEditInput(req);
    if (!authUser) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    if (!canModifyMonitoringData(authUser.roleName)) {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    const sessionId = parsePositiveInt(input.sessionId);
    const depthMin = parseNonNegativeNumber(input.depthMin ?? input.startDepth);
    const depthMax = parseNonNegativeNumber(input.depthMax ?? input.endDepth);
    const includeHidden = parseOptionalBoolean(input.includeHidden, false);
    const note = parseOptionalNote(input.note);
    if (sessionId === null) {
        res.status(400).json({ message: "Valid sessionId is required" });
        return null;
    }
    if (depthMin === null) {
        res.status(400).json({ message: "depthMin/startDepth must be a non-negative number" });
        return null;
    }
    if (depthMax === null) {
        res.status(400).json({ message: "depthMax/endDepth must be a non-negative number" });
        return null;
    }
    if (includeHidden === null) {
        res.status(400).json({ message: "includeHidden must be true or false" });
        return null;
    }
    if (note === "invalid") {
        res.status(400).json({ message: "note must be a string" });
        return null;
    }
    const session = await sessionService.getSessionById(sessionId);
    if (!session) {
        res.status(404).json({ message: "Session not found" });
        return null;
    }
    if (!canAccessSession(req, session.userId)) {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    return {
        sessionId,
        depthMin,
        depthMax,
        includeHidden,
        editedById: authUser.userId,
        note,
    };
};
const resolveDepthOffset = (body, depthMin) => {
    const explicitOffset = parseFiniteNumber(body.depthOffset);
    if (explicitOffset !== null) {
        return explicitOffset;
    }
    const targetStartDepth = parseNonNegativeNumber(body.targetStartDepth ?? body.targetDepthStart);
    if (targetStartDepth !== null) {
        return targetStartDepth - depthMin;
    }
    return null;
};
export const hideDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        if (!base) {
            return;
        }
        const result = await mwdDataEditService.setHiddenByDepthRange({
            ...base,
            hidden: true,
        });
        res.json({ message: "MWD data depth range hidden", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const unhideDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        if (!base) {
            return;
        }
        const result = await mwdDataEditService.setHiddenByDepthRange({
            ...base,
            includeHidden: true,
            hidden: false,
        });
        res.json({ message: "MWD data depth range unhidden", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const deleteDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        if (!base) {
            return;
        }
        const result = await mwdDataEditService.deleteDepthRange(base);
        res.json({ message: "MWD data depth range deleted", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const moveDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const depthOffset = resolveDepthOffset(input, base.depthMin);
        if (depthOffset === null || depthOffset === 0) {
            return res.status(400).json({
                message: "depthOffset or targetStartDepth is required and must not be 0",
            });
        }
        const result = await mwdDataEditService.moveDepthRange({
            ...base,
            depthOffset,
        });
        res.json({ message: "MWD data depth range moved", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const previewMoveDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const depthOffset = resolveDepthOffset(input, base.depthMin);
        if (depthOffset === null || depthOffset === 0) {
            return res.status(400).json({
                message: "depthOffset or targetStartDepth is required and must not be 0",
            });
        }
        const result = await mwdDataEditService.previewMoveDepthRange({
            ...base,
            depthOffset,
        });
        res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const copyDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const depthOffset = resolveDepthOffset(input, base.depthMin);
        const measuredAtOffsetMs = input.measuredAtOffsetMs === undefined
            ? undefined
            : parseFiniteNumber(input.measuredAtOffsetMs);
        if (depthOffset === null || depthOffset === 0) {
            return res.status(400).json({
                message: "depthOffset or targetStartDepth is required and must not be 0",
            });
        }
        if (input.measuredAtOffsetMs !== undefined && measuredAtOffsetMs === null) {
            return res.status(400).json({ message: "measuredAtOffsetMs must be a valid number" });
        }
        const result = await mwdDataEditService.copyDepthRange({
            ...base,
            depthOffset,
            ...(typeof measuredAtOffsetMs === "number" ? { measuredAtOffsetMs } : {}),
        });
        res.status(201).json({ message: "MWD data depth range copied", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const previewCopyDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const depthOffset = resolveDepthOffset(input, base.depthMin);
        const measuredAtOffsetMs = input.measuredAtOffsetMs === undefined
            ? undefined
            : parseFiniteNumber(input.measuredAtOffsetMs);
        if (depthOffset === null || depthOffset === 0) {
            return res.status(400).json({
                message: "depthOffset or targetStartDepth is required and must not be 0",
            });
        }
        if (input.measuredAtOffsetMs !== undefined && measuredAtOffsetMs === null) {
            return res.status(400).json({ message: "measuredAtOffsetMs must be a valid number" });
        }
        const result = await mwdDataEditService.previewCopyDepthRange({
            ...base,
            depthOffset,
            ...(typeof measuredAtOffsetMs === "number" ? { measuredAtOffsetMs } : {}),
        });
        res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const rescaleDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const field = typeof input.field === "string" ? input.field.trim() : "";
        const scaleFactor = parseFiniteNumber(input.scaleFactor ?? input.scale);
        const biasOffset = parseFiniteNumber(input.biasOffset ?? input.bias ?? 0);
        if (!MWD_MEASUREMENT_FIELDS.includes(field)) {
            return res.status(400).json({
                message: `field must be one of: ${MWD_MEASUREMENT_FIELDS.join(", ")}`,
            });
        }
        if (scaleFactor === null) {
            return res.status(400).json({ message: "scaleFactor/scale must be a valid number" });
        }
        if (biasOffset === null) {
            return res.status(400).json({ message: "biasOffset/bias must be a valid number" });
        }
        const result = await mwdDataEditService.rescaleDepthRange({
            ...base,
            field: field,
            scaleFactor,
            biasOffset,
        });
        res.json({ message: "MWD data depth range rescaled", ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const previewRescaleDepthRange = async (req, res) => {
    try {
        const base = await parseEditBaseInput(req, res);
        const input = getEditInput(req);
        if (!base) {
            return;
        }
        const field = typeof input.field === "string" ? input.field.trim() : "";
        const scaleFactor = parseFiniteNumber(input.scaleFactor ?? input.scale);
        const biasOffset = parseFiniteNumber(input.biasOffset ?? input.bias ?? 0);
        if (!MWD_MEASUREMENT_FIELDS.includes(field)) {
            return res.status(400).json({
                message: `field must be one of: ${MWD_MEASUREMENT_FIELDS.join(", ")}`,
            });
        }
        if (scaleFactor === null) {
            return res.status(400).json({ message: "scaleFactor/scale must be a valid number" });
        }
        if (biasOffset === null) {
            return res.status(400).json({ message: "biasOffset/bias must be a valid number" });
        }
        const result = await mwdDataEditService.previewRescaleDepthRange({
            ...base,
            field: field,
            scaleFactor,
            biasOffset,
        });
        res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getEditOperations = async (req, res) => {
    try {
        const sessionIdParam = req.query.sessionId;
        const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : undefined;
        const limitParam = req.query.limit;
        const limit = typeof limitParam === "string" ? parsePositiveInt(limitParam) : undefined;
        if (sessionIdParam !== undefined && sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        if (limitParam !== undefined && limit === null) {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        if (sessionId !== undefined && sessionId !== null) {
            const session = await sessionService.getSessionById(sessionId);
            if (!session) {
                return res.status(404).json({ message: "Session not found" });
            }
            if (!canAccessSession(req, session.userId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const operations = await mwdDataEditService.getEditOperations({
            ...(sessionId !== undefined && sessionId !== null ? { sessionId } : {}),
            ...(limit !== undefined && limit !== null ? { limit } : {}),
        });
        res.json({ count: operations.length, data: operations });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
//# sourceMappingURL=mwd-data-edit.controller.js.map