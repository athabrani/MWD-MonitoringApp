import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as sessionService from "../services/mwd-session.service.js";
import * as surveyService from "../services/survey.service.js";
import { createAuditLog } from "../services/audit-log.service.js";
import { canAccessSessionOwner, canModifyMonitoringData, canViewAllSessions, } from "../utils/roles.js";
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
const parseOptionalBoolean = (value, fallback = false) => {
    if (value === undefined) {
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
const parseOptionalNumber = (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
        return { provided: false, value: undefined };
    }
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number(value.trim())
            : NaN;
    return Number.isFinite(parsed)
        ? { provided: true, value: parsed }
        : { provided: true, error: `${fieldName} must be a valid number` };
};
const parseRequiredNumber = (value, fieldName) => {
    const parsed = parseOptionalNumber(value, fieldName);
    if ("error" in parsed) {
        return parsed;
    }
    return parsed.provided
        ? parsed
        : { provided: true, error: `${fieldName} is required` };
};
const normalizeStationType = (value, fallback = "actual") => {
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
    return normalized || fallback;
};
const normalizeOptionalText = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return typeof value === "string" ? value.trim() || null : null;
};
const getAuthUser = (req) => req.user;
const canAccessSession = (req, sessionUserId) => {
    const user = getAuthUser(req);
    return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
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
const ensureCanWriteSurvey = (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
        res.status(401).json({ message: "Unauthorized" });
        return false;
    }
    if (!canModifyMonitoringData(authUser.roleName)) {
        res.status(403).json({ message: "Forbidden" });
        return false;
    }
    return true;
};
const buildSurveyStationInput = (body, mode) => {
    const data = {};
    if (mode === "create" || body.sessionId !== undefined) {
        const sessionId = parsePositiveInt(body.sessionId);
        if (sessionId === null) {
            return { error: "Valid sessionId is required" };
        }
        data.sessionId = sessionId;
    }
    if (body.stationType !== undefined) {
        data.stationType = normalizeStationType(body.stationType);
    }
    for (const fieldName of [
        "measuredDepth",
        "inclination",
        "azimuth",
    ]) {
        const parsed = mode === "create"
            ? parseRequiredNumber(body[fieldName], fieldName)
            : parseOptionalNumber(body[fieldName], fieldName);
        if ("error" in parsed) {
            return { error: parsed.error };
        }
        if (parsed.provided) {
            data[fieldName] = parsed.value;
        }
    }
    for (const fieldName of [
        "tvd",
        "northing",
        "easting",
        "verticalSectionAzimuth",
    ]) {
        const parsed = parseOptionalNumber(body[fieldName], fieldName);
        if ("error" in parsed) {
            return { error: parsed.error };
        }
        if (parsed.provided) {
            data[fieldName] = parsed.value;
        }
        else if (body[fieldName] === null || body[fieldName] === "") {
            data[fieldName] = null;
        }
    }
    if (body.source !== undefined) {
        data.source =
            typeof body.source === "string" && body.source.trim()
                ? body.source.trim()
                : "manual";
    }
    if (body.notes !== undefined) {
        data.notes = normalizeOptionalText(body.notes);
    }
    if (mode === "update" && Object.keys(data).length === 0) {
        return { error: "No valid fields to update" };
    }
    return { data };
};
const handleSurveyWriteError = (error, res) => {
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002") {
        return res.status(409).json({
            message: "Survey station already exists at this measured depth",
        });
    }
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2003") {
        return res.status(400).json({ message: "Session not found" });
    }
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025") {
        return res.status(404).json({ message: "Survey station not found" });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
};
export const createSurveyStation = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const result = buildSurveyStationInput(req.body ?? {}, "create");
        if ("error" in result) {
            return res.status(400).json({ message: result.error });
        }
        const sessionId = Number(result.data.sessionId);
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const station = await surveyService.createSurveyStation(result.data);
        const authUser = getAuthUser(req);
        const stationRecord = toRecord(station);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.create",
            details: `Created survey station for session ${sessionId}`,
            metadata: {
                surveyStationId: stationRecord.id !== undefined ? String(stationRecord.id) : null,
                sessionId,
                measuredDepth: stationRecord.measuredDepth !== undefined
                    ? String(stationRecord.measuredDepth)
                    : null,
            },
        });
        res.status(201).json(station);
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
export const getSurveyStations = async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        const sessionIdParam = req.query.sessionId;
        const sessionId = typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (sessionIdParam !== undefined && sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        if (sessionId !== null) {
            const session = await ensureSessionAccess(req, res, sessionId);
            if (!session) {
                return;
            }
        }
        const stationType = typeof req.query.stationType === "string"
            ? normalizeStationType(req.query.stationType)
            : undefined;
        const filters = {
            ...(sessionId !== null ? { sessionId } : {}),
            ...(stationType !== undefined ? { stationType } : {}),
            ...(!canViewAllSessions(authUser.roleName)
                ? { ownerUserId: authUser.userId }
                : {}),
        };
        const data = await surveyService.getSurveyStations(filters);
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
export const getSurveyTrajectoryPlotData = async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        const sessionId = typeof req.query.sessionId === "string"
            ? parsePositiveInt(req.query.sessionId)
            : null;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const depthMin = parseOptionalNumber(req.query.depthMin, "depthMin");
        const depthMax = parseOptionalNumber(req.query.depthMax, "depthMax");
        if ("error" in depthMin) {
            return res.status(400).json({ message: depthMin.error });
        }
        if ("error" in depthMax) {
            return res.status(400).json({ message: depthMax.error });
        }
        if (depthMin.value !== undefined &&
            depthMax.value !== undefined &&
            depthMin.value > depthMax.value) {
            return res.status(400).json({ message: "depthMin must be less than or equal to depthMax" });
        }
        const data = await surveyService.getTrajectoryPlotData({
            sessionId,
            ...(depthMin.value !== undefined ? { depthMin: depthMin.value } : {}),
            ...(depthMax.value !== undefined ? { depthMax: depthMax.value } : {}),
            actualStationType: normalizeStationType(req.query.actualStationType, "actual"),
            planStationType: normalizeStationType(req.query.planStationType, "plan"),
        });
        res.json(data);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getSurveyStationById = async (req, res) => {
    try {
        const id = parsePositiveBigInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid survey station id" });
        }
        const station = (await surveyService.getSurveyStationById(id));
        if (!station) {
            return res.status(404).json({ message: "Survey station not found" });
        }
        if (!station.session || !canAccessSession(req, station.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(station);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const updateSurveyStation = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const id = parsePositiveBigInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid survey station id" });
        }
        const existing = (await surveyService.getSurveyStationById(id));
        if (!existing) {
            return res.status(404).json({ message: "Survey station not found" });
        }
        if (!existing.session || !canAccessSession(req, existing.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const result = buildSurveyStationInput(req.body ?? {}, "update");
        if ("error" in result) {
            return res.status(400).json({ message: result.error });
        }
        if (result.data.sessionId !== undefined) {
            const session = await ensureSessionAccess(req, res, Number(result.data.sessionId));
            if (!session) {
                return;
            }
        }
        const station = await surveyService.updateSurveyStation(id, result.data);
        if (!station) {
            return res.status(404).json({ message: "Survey station not found" });
        }
        const authUser = getAuthUser(req);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.update",
            details: `Updated survey station ${id.toString()}`,
            metadata: {
                surveyStationId: id.toString(),
                updatedFields: Object.keys(result.data),
            },
        });
        res.json(station);
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
export const deleteSurveyStation = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const id = parsePositiveBigInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid survey station id" });
        }
        const existing = (await surveyService.getSurveyStationById(id));
        if (!existing) {
            return res.status(404).json({ message: "Survey station not found" });
        }
        if (!existing.session || !canAccessSession(req, existing.session.userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const authUser = getAuthUser(req);
        await surveyService.deleteSurveyStation(id);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.delete",
            details: `Deleted survey station ${id.toString()}`,
            metadata: {
                surveyStationId: id.toString(),
            },
        });
        res.json({ message: "Survey station deleted successfully" });
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
export const recalculateSurveyStations = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const sessionId = parsePositiveInt(req.body?.sessionId);
        if (sessionId === null) {
            return res.status(400).json({ message: "Valid sessionId is required" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const verticalSectionAzimuth = parseOptionalNumber(req.body?.verticalSectionAzimuth, "verticalSectionAzimuth");
        if ("error" in verticalSectionAzimuth) {
            return res.status(400).json({ message: verticalSectionAzimuth.error });
        }
        const data = await surveyService.recalculateSurveyStations(sessionId, normalizeStationType(req.body?.stationType), verticalSectionAzimuth.value);
        const authUser = getAuthUser(req);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.recalculate",
            details: `Recalculated survey stations for session ${sessionId}`,
            metadata: {
                sessionId,
                count: data.length,
            },
        });
        res.json({
            count: data.length,
            data,
        });
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
export const importSurveyFromMwdData = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const sessionId = parsePositiveInt(req.body?.sessionId);
        if (sessionId === null) {
            return res.status(400).json({ message: "Valid sessionId is required" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const replace = parseOptionalBoolean(req.body?.replace, false);
        if (replace === null) {
            return res.status(400).json({ message: "replace must be true or false" });
        }
        const verticalSectionAzimuth = parseOptionalNumber(req.body?.verticalSectionAzimuth, "verticalSectionAzimuth");
        if ("error" in verticalSectionAzimuth) {
            return res.status(400).json({ message: verticalSectionAzimuth.error });
        }
        const importInput = {
            sessionId,
            stationType: normalizeStationType(req.body?.stationType),
            replace,
        };
        if (verticalSectionAzimuth.value !== undefined) {
            importInput.verticalSectionAzimuth = verticalSectionAzimuth.value;
        }
        const result = await surveyService.importSurveyFromMwdData(importInput);
        const authUser = getAuthUser(req);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.import_from_mwd",
            details: `Imported survey stations from MWD data for session ${sessionId}`,
            metadata: {
                sessionId,
                importedCount: result.importedCount,
                stationType: importInput.stationType ?? null,
            },
        });
        res.status(201).json(result);
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
export const importWellPlanCsv = async (req, res) => {
    try {
        if (!ensureCanWriteSurvey(req, res)) {
            return;
        }
        const rawBody = req.body;
        const sessionId = parsePositiveInt(typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
            ? rawBody.sessionId
            : req.query.sessionId);
        if (sessionId === null) {
            return res.status(400).json({ message: "Valid sessionId is required" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session) {
            return;
        }
        const body = typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
            ? rawBody
            : {};
        const csv = typeof rawBody === "string"
            ? rawBody
            : typeof body.csv === "string"
                ? body.csv
                : "";
        if (!csv.trim()) {
            return res.status(400).json({ message: "CSV content is required" });
        }
        const replace = parseOptionalBoolean(body.replace ?? req.query.replace, true);
        if (replace === null) {
            return res.status(400).json({ message: "replace must be true or false" });
        }
        const verticalSectionAzimuth = parseOptionalNumber(body.verticalSectionAzimuth ?? req.query.verticalSectionAzimuth, "verticalSectionAzimuth");
        if ("error" in verticalSectionAzimuth) {
            return res.status(400).json({ message: verticalSectionAzimuth.error });
        }
        const importInput = {
            sessionId,
            csv,
            replace,
            stationType: normalizeStationType(body.stationType, "well_plan"),
        };
        if (verticalSectionAzimuth.value !== undefined) {
            importInput.verticalSectionAzimuth = verticalSectionAzimuth.value;
        }
        const result = await surveyService.importWellPlanCsv(importInput);
        const authUser = getAuthUser(req);
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "survey.import_well_plan",
            details: `Imported well plan CSV for session ${sessionId}`,
            metadata: {
                sessionId,
                importedCount: result.importedCount,
                skippedCount: result.skippedCount,
                stationType: importInput.stationType ?? null,
            },
        });
        res.status(201).json(result);
    }
    catch (error) {
        return handleSurveyWriteError(error, res);
    }
};
//# sourceMappingURL=survey.controller.js.map