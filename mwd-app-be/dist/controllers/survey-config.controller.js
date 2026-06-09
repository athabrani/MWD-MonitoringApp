import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as sessionService from "../services/mwd-session.service.js";
import * as surveyConfigService from "../services/survey-config.service.js";
import { createAuditLog } from "../services/audit-log.service.js";
import { canAccessSessionOwner, canModifyMonitoringData, } from "../utils/roles.js";
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
const parseNullableText = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null || value === "")
        return null;
    return typeof value === "string" ? value.trim() || null : "invalid";
};
const parseNullableNumber = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null || value === "")
        return null;
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number(value.trim())
            : NaN;
    return Number.isFinite(parsed) ? parsed : "invalid";
};
const getAuthUser = (req) => req.user;
const ensureSessionAccess = async (req, res, sessionId) => {
    const user = getAuthUser(req);
    const session = await sessionService.getSessionById(sessionId);
    if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    if (!session) {
        res.status(404).json({ message: "Session not found" });
        return null;
    }
    if (!canAccessSessionOwner(user.roleName, user.userId, session.userId)) {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    return session;
};
const buildSurveyConfigInput = (sessionId, body) => {
    const input = { sessionId };
    for (const field of [
        "wellName",
        "rigName",
        "companyName",
        "fieldName",
        "location",
        "units",
        "northReference",
        "sectionType",
    ]) {
        const parsed = parseNullableText(body[field]);
        if (parsed === "invalid") {
            return { error: `${field} must be a string` };
        }
        if (parsed !== undefined) {
            input[field] = parsed;
        }
    }
    for (const field of [
        "proposedAzimuth",
        "surveyDepthOffset",
        "declination",
        "latitude",
        "longitude",
        "northingOrigin",
        "eastingOrigin",
        "elevationKb",
        "elevationDf",
        "elevationGl",
    ]) {
        const parsed = parseNullableNumber(body[field]);
        if (parsed === "invalid") {
            return { error: `${field} must be a valid number` };
        }
        if (parsed !== undefined) {
            input[field] = parsed;
        }
    }
    if (body.plotTemplateId !== undefined) {
        const plotTemplateId = body.plotTemplateId === null || body.plotTemplateId === ""
            ? null
            : parsePositiveInt(body.plotTemplateId);
        if (plotTemplateId === null && body.plotTemplateId !== null && body.plotTemplateId !== "") {
            return { error: "plotTemplateId must be a positive integer" };
        }
        input.plotTemplateId = plotTemplateId;
    }
    return { input };
};
export const getSurveyConfig = async (req, res) => {
    try {
        const sessionId = parsePositiveInt(req.params.sessionId);
        if (sessionId === null) {
            return res.status(400).json({ message: "Invalid session id" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session)
            return;
        const config = await surveyConfigService.getSurveyConfigBySessionId(sessionId);
        res.json({
            data: config,
        });
    }
    catch {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const upsertSurveyConfig = async (req, res) => {
    try {
        const user = getAuthUser(req);
        const sessionId = parsePositiveInt(req.params.sessionId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!canModifyMonitoringData(user.roleName)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (sessionId === null) {
            return res.status(400).json({ message: "Invalid session id" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session)
            return;
        const result = buildSurveyConfigInput(sessionId, req.body ?? {});
        if ("error" in result) {
            return res.status(400).json({ message: result.error });
        }
        const config = await surveyConfigService.upsertSurveyConfig(result.input);
        await createAuditLog({
            userId: user.userId,
            action: "survey_config.upsert",
            details: `Saved survey config for session ${sessionId}`,
            metadata: {
                sessionId,
                updatedFields: Object.keys(req.body ?? {}),
            },
        });
        res.json(config);
    }
    catch (error) {
        if (error instanceof PrismaClientKnownRequestError &&
            error.code === "P2003") {
            return res.status(400).json({ message: "Invalid session or plot template" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};
export const deleteSurveyConfig = async (req, res) => {
    try {
        const user = getAuthUser(req);
        const sessionId = parsePositiveInt(req.params.sessionId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!canModifyMonitoringData(user.roleName)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (sessionId === null) {
            return res.status(400).json({ message: "Invalid session id" });
        }
        const session = await ensureSessionAccess(req, res, sessionId);
        if (!session)
            return;
        await surveyConfigService.deleteSurveyConfig(sessionId);
        await createAuditLog({
            userId: user.userId,
            action: "survey_config.delete",
            details: `Deleted survey config for session ${sessionId}`,
            metadata: { sessionId },
        });
        res.json({ message: "Survey config deleted successfully" });
    }
    catch (error) {
        if (error instanceof PrismaClientKnownRequestError &&
            error.code === "P2025") {
            return res.status(404).json({ message: "Survey config not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};
//# sourceMappingURL=survey-config.controller.js.map