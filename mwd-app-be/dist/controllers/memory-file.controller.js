import * as memoryFileService from "../services/memory-file.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import { canAccessSessionOwner, canModifyMonitoringData, canViewAllSessions, } from "../utils/roles.js";
import { createAuditLog } from "../services/audit-log.service.js";
const MAX_MEMORY_IMPORT_ROWS = 50_000;
const MAX_MEMORY_IMPORT_CONTENT_LENGTH = 10 * 1024 * 1024;
const ALLOWED_MEMORY_FILE_EXTENSIONS = new Set([".csv", ".txt", ".tsv"]);
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
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number(value.trim())
            : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const parseFiniteNumber = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number(value.trim())
            : NaN;
    return Number.isFinite(parsed) ? parsed : null;
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
const parseOptionalString = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return typeof value === "string" ? value.trim() : null;
};
const parseOptionalStringArray = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        return value.map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return null;
};
const parseJsonLike = (value) => {
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
        return value;
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return "invalid-json";
    }
};
const getFileExtension = (fileName) => {
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
};
const getAuthUser = (req) => req.user;
const canAccessSession = (req, sessionUserId) => {
    const user = getAuthUser(req);
    return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};
const ensureCanModify = (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    if (!canModifyMonitoringData(authUser.roleName)) {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    return authUser;
};
const ensureSessionAccess = async (req, res, sessionId) => {
    const session = await sessionService.getSessionById(sessionId);
    if (!session) {
        res.status(404).json({ message: "Session not found" });
        return null;
    }
    if (!canAccessSession(req, session.userId)) {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    return session;
};
const getRequestInput = (req) => {
    if (typeof req.body === "string") {
        return {
            ...req.query,
            content: req.body,
        };
    }
    return {
        ...req.query,
        ...(req.body ?? {}),
    };
};
export const importMemoryFile = async (req, res) => {
    try {
        const authUser = ensureCanModify(req, res);
        if (!authUser) {
            return;
        }
        const input = getRequestInput(req);
        const sessionId = parsePositiveInt(input.sessionId);
        const fileName = parseOptionalString(input.fileName ?? input.name);
        const source = parseOptionalString(input.source);
        const content = parseOptionalString(input.content ?? input.csv ?? input.text);
        const delimiter = parseOptionalString(input.delimiter);
        const depthField = parseOptionalString(input.depthField ?? input.depthColumn);
        const measuredAtField = parseOptionalString(input.measuredAtField ?? input.timeField ?? input.timestampField);
        const hasHeader = input.hasHeader === undefined
            ? undefined
            : parseOptionalBoolean(input.hasHeader, true);
        const columns = parseOptionalStringArray(input.columns);
        const fieldMappings = parseJsonLike(input.fieldMappings ?? input.mappings ?? input.mapping);
        const rows = input.rows;
        if (sessionId === null) {
            return res.status(400).json({ message: "Valid sessionId is required" });
        }
        if (fileName === null) {
            return res.status(400).json({ message: "fileName must be a string" });
        }
        if (fileName !== undefined &&
            getFileExtension(fileName) &&
            !ALLOWED_MEMORY_FILE_EXTENSIONS.has(getFileExtension(fileName))) {
            return res.status(400).json({
                message: "fileName must use .csv, .txt, or .tsv extension",
            });
        }
        if (source === null) {
            return res.status(400).json({ message: "source must be a string" });
        }
        if (content === null) {
            return res.status(400).json({ message: "content/csv must be a string" });
        }
        if (content !== undefined &&
            Buffer.byteLength(content, "utf8") > MAX_MEMORY_IMPORT_CONTENT_LENGTH) {
            return res.status(400).json({ message: "Import content is too large" });
        }
        if (delimiter === null) {
            return res.status(400).json({ message: "delimiter must be a string" });
        }
        if (depthField === null) {
            return res.status(400).json({ message: "depthField must be a string" });
        }
        if (measuredAtField === null) {
            return res.status(400).json({ message: "measuredAtField must be a string" });
        }
        if (hasHeader === null) {
            return res.status(400).json({ message: "hasHeader must be true or false" });
        }
        if (columns === null) {
            return res.status(400).json({ message: "columns must be an array or comma-separated string" });
        }
        if (fieldMappings === "invalid-json") {
            return res.status(400).json({ message: "fieldMappings must be valid JSON" });
        }
        if (rows !== undefined && !Array.isArray(rows)) {
            return res.status(400).json({ message: "rows must be an array" });
        }
        if (Array.isArray(rows) && rows.length > MAX_MEMORY_IMPORT_ROWS) {
            return res.status(400).json({
                message: `rows must contain at most ${MAX_MEMORY_IMPORT_ROWS} items`,
            });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const result = await memoryFileService.importMemoryFile({
            sessionId,
            importedById: authUser.userId,
            ...(fileName !== undefined ? { fileName } : {}),
            ...(source !== undefined ? { source } : {}),
            ...(content !== undefined ? { content } : {}),
            ...(Array.isArray(rows) ? { rows: rows.filter((row) => typeof row === "object" && row !== null && !Array.isArray(row)) } : {}),
            ...(delimiter !== undefined ? { delimiter } : {}),
            ...(hasHeader !== undefined ? { hasHeader } : {}),
            ...(columns !== undefined ? { columns } : {}),
            ...(depthField !== undefined ? { depthField } : {}),
            ...(measuredAtField !== undefined ? { measuredAtField } : {}),
            ...(fieldMappings !== undefined ? { fieldMappings } : {}),
        });
        await createAuditLog({
            userId: authUser.userId,
            action: "memory_file.import",
            details: `Imported memory file ${result.file.fileName}`,
            metadata: {
                sessionId,
                memoryFileId: result.file.id,
                importedCount: result.importedCount,
            },
        });
        res.status(201).json({
            message: "Memory file imported",
            ...result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getMemoryFiles = async (req, res) => {
    try {
        const authUser = getAuthUser(req);
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
            const session = await ensureSessionAccess(req, res, sessionId);
            if (!session) {
                return;
            }
        }
        const files = await memoryFileService.getMemoryFiles({
            ...(sessionId !== undefined && sessionId !== null ? { sessionId } : {}),
            ...(limit !== undefined && limit !== null ? { limit } : {}),
        });
        const filteredFiles = authUser && canViewAllSessions(authUser.roleName)
            ? files
            : files.filter((file) => {
                const session = file.session;
                return (typeof session === "object" &&
                    session !== null &&
                    "userId" in session &&
                    session.userId === authUser?.userId);
            });
        res.json({ count: filteredFiles.length, data: filteredFiles });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getMemoryFileById = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid memory file id" });
        }
        const file = await memoryFileService.getMemoryFileById(id);
        if (!file) {
            return res.status(404).json({ message: "Memory file not found" });
        }
        const session = file.session;
        const sessionUserId = typeof session === "object" && session !== null && "userId" in session
            ? Number(session.userId)
            : NaN;
        if (!Number.isInteger(sessionUserId) || !canAccessSession(req, sessionUserId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(file);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getMemoryDataPoints = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        const limitParam = req.query.limit;
        const skipParam = req.query.skip;
        const limit = typeof limitParam === "string" ? parsePositiveInt(limitParam) : undefined;
        const skip = typeof skipParam === "string" ? parseNonNegativeNumber(skipParam) : undefined;
        if (id === null) {
            return res.status(400).json({ message: "Invalid memory file id" });
        }
        if (limitParam !== undefined && limit === null) {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        if (skipParam !== undefined && skip === null) {
            return res.status(400).json({ message: "skip must be a non-negative number" });
        }
        const file = await memoryFileService.getMemoryFileById(id);
        if (!file) {
            return res.status(404).json({ message: "Memory file not found" });
        }
        const session = file.session;
        const sessionUserId = typeof session === "object" && session !== null && "userId" in session
            ? Number(session.userId)
            : NaN;
        if (!Number.isInteger(sessionUserId) || !canAccessSession(req, sessionUserId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const data = await memoryFileService.getMemoryDataPoints(id, {
            ...(limit !== undefined && limit !== null ? { limit } : {}),
            ...(skip !== undefined && skip !== null ? { skip } : {}),
        });
        res.json({ count: data.length, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const deleteMemoryFile = async (req, res) => {
    try {
        const authUser = ensureCanModify(req, res);
        const id = parsePositiveInt(req.params.id);
        if (!authUser) {
            return;
        }
        if (id === null) {
            return res.status(400).json({ message: "Invalid memory file id" });
        }
        const file = await memoryFileService.getMemoryFileById(id);
        if (!file) {
            return res.status(404).json({ message: "Memory file not found" });
        }
        const session = file.session;
        const sessionUserId = typeof session === "object" && session !== null && "userId" in session
            ? Number(session.userId)
            : NaN;
        if (!Number.isInteger(sessionUserId) || !canAccessSession(req, sessionUserId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await memoryFileService.deleteMemoryFile(id);
        res.json({ message: "Memory file deleted" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const correlateMemoryFile = async (req, res) => {
    try {
        const authUser = ensureCanModify(req, res);
        const id = parsePositiveInt(req.params.id);
        const body = getRequestInput(req);
        if (!authUser) {
            return;
        }
        if (id === null) {
            return res.status(400).json({ message: "Invalid memory file id" });
        }
        const file = await memoryFileService.getMemoryFileById(id);
        if (!file) {
            return res.status(404).json({ message: "Memory file not found" });
        }
        const session = file.session;
        const sessionUserId = typeof session === "object" && session !== null && "userId" in session
            ? Number(session.userId)
            : NaN;
        if (!Number.isInteger(sessionUserId) || !canAccessSession(req, sessionUserId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const mode = body.mode === undefined || body.mode === ""
            ? undefined
            : typeof body.mode === "string" && ["depth", "timestamp"].includes(body.mode)
                ? body.mode
                : null;
        const depthOffset = parseFiniteNumber(body.depthOffset ?? body.depthShift);
        const measuredAtOffsetMs = parseFiniteNumber(body.measuredAtOffsetMs ?? body.timeOffsetMs);
        const maxDepthDifference = parseNonNegativeNumber(body.maxDepthDifference ?? body.depthTolerance);
        const maxTimeDifferenceMs = parseNonNegativeNumber(body.maxTimeDifferenceMs ?? body.timeToleranceMs);
        const includeHidden = parseOptionalBoolean(body.includeHidden, false);
        const dryRun = parseOptionalBoolean(body.dryRun ?? body.preview, false);
        const fieldMappings = parseJsonLike(body.fieldMappings ?? body.mappings ?? body.mapping);
        if (mode === null) {
            return res.status(400).json({ message: "mode must be depth or timestamp" });
        }
        if (depthOffset === null) {
            return res.status(400).json({ message: "depthOffset/depthShift must be a valid number" });
        }
        if (measuredAtOffsetMs === null) {
            return res.status(400).json({ message: "measuredAtOffsetMs/timeOffsetMs must be a valid number" });
        }
        if (maxDepthDifference === null) {
            return res.status(400).json({ message: "maxDepthDifference/depthTolerance must be non-negative" });
        }
        if (maxTimeDifferenceMs === null) {
            return res.status(400).json({ message: "maxTimeDifferenceMs/timeToleranceMs must be non-negative" });
        }
        if (includeHidden === null) {
            return res.status(400).json({ message: "includeHidden must be true or false" });
        }
        if (dryRun === null) {
            return res.status(400).json({ message: "dryRun/preview must be true or false" });
        }
        if (fieldMappings === "invalid-json") {
            return res.status(400).json({ message: "fieldMappings must be valid JSON" });
        }
        const result = await memoryFileService.correlateMemoryFile({
            memoryFileId: id,
            correlatedById: authUser.userId,
            ...(mode !== undefined ? { mode } : {}),
            ...(depthOffset !== undefined ? { depthOffset } : {}),
            ...(measuredAtOffsetMs !== undefined ? { measuredAtOffsetMs } : {}),
            ...(maxDepthDifference !== undefined ? { maxDepthDifference } : {}),
            ...(maxTimeDifferenceMs !== undefined ? { maxTimeDifferenceMs } : {}),
            includeHidden,
            dryRun,
            ...(fieldMappings !== undefined ? { fieldMappings } : {}),
        });
        res.json({
            message: dryRun ? "Memory correlation preview" : "Memory file correlated",
            ...result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getMemoryCorrelations = async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        const sessionIdParam = req.query.sessionId;
        const memoryFileIdParam = req.query.memoryFileId;
        const limitParam = req.query.limit;
        const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : undefined;
        const memoryFileId = typeof memoryFileIdParam === "string"
            ? parsePositiveInt(memoryFileIdParam)
            : undefined;
        const limit = typeof limitParam === "string" ? parsePositiveInt(limitParam) : undefined;
        if (sessionIdParam !== undefined && sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        if (memoryFileIdParam !== undefined && memoryFileId === null) {
            return res.status(400).json({ message: "memoryFileId must be a positive integer" });
        }
        if (limitParam !== undefined && limit === null) {
            return res.status(400).json({ message: "limit must be a positive integer" });
        }
        if (sessionId !== undefined && sessionId !== null) {
            const session = await ensureSessionAccess(req, res, sessionId);
            if (!session) {
                return;
            }
        }
        const correlations = await memoryFileService.getMemoryCorrelations({
            ...(sessionId !== undefined && sessionId !== null ? { sessionId } : {}),
            ...(memoryFileId !== undefined && memoryFileId !== null ? { memoryFileId } : {}),
            ...(limit !== undefined && limit !== null ? { limit } : {}),
        });
        if (authUser && canViewAllSessions(authUser.roleName)) {
            return res.json({ count: correlations.length, data: correlations });
        }
        res.json({ count: correlations.length, data: correlations });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
//# sourceMappingURL=memory-file.controller.js.map