import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as failoverEventService from "../services/failover-event.service.js";
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
const normalizeString = (value) => {
    return typeof value === "string" ? value.trim() : "";
};
const parseOptionalDate = (value) => {
    if (value === undefined) {
        return { provided: false, value: undefined };
    }
    if (value === null || value === "") {
        return { provided: true, value: null };
    }
    if (typeof value !== "string") {
        return { provided: true, value: "invalid" };
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? { provided: true, value: "invalid" }
        : { provided: true, value: date };
};
const handleFailoverEventWriteError = (error, res) => {
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2003") {
        return res.status(400).json({ message: "Connection status not found" });
    }
    if (error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025") {
        return res.status(404).json({ message: "Failover event not found" });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
};
export const createFailoverEvent = async (req, res) => {
    try {
        const connectionStatusId = parsePositiveInt(req.body?.connectionStatusId);
        const fromNode = normalizeString(req.body?.fromNode);
        const toNode = normalizeString(req.body?.toNode);
        const reason = normalizeString(req.body?.reason);
        const eventAt = parseOptionalDate(req.body?.eventAt);
        const resolvedAt = parseOptionalDate(req.body?.resolvedAt);
        if (connectionStatusId === null) {
            return res.status(400).json({ message: "Valid connectionStatusId is required" });
        }
        if (eventAt.value === "invalid") {
            return res.status(400).json({ message: "eventAt must be a valid date" });
        }
        if (resolvedAt.value === "invalid") {
            return res.status(400).json({ message: "resolvedAt must be a valid date" });
        }
        const input = {
            connectionStatusId,
            fromNode: fromNode || null,
            toNode: toNode || null,
            reason: reason || null,
        };
        if (eventAt.provided && eventAt.value instanceof Date) {
            input.eventAt = eventAt.value;
        }
        if (resolvedAt.provided &&
            (resolvedAt.value === null || resolvedAt.value instanceof Date)) {
            input.resolvedAt = resolvedAt.value;
        }
        const failoverEvent = await failoverEventService.createFailoverEvent(input);
        res.status(201).json(failoverEvent);
    }
    catch (error) {
        return handleFailoverEventWriteError(error, res);
    }
};
export const getAllFailoverEvents = async (req, res) => {
    try {
        const connectionStatusIdParam = req.query.connectionStatusId;
        const connectionStatusId = typeof connectionStatusIdParam === "string"
            ? parsePositiveInt(connectionStatusIdParam)
            : null;
        if (connectionStatusIdParam !== undefined && connectionStatusId === null) {
            return res
                .status(400)
                .json({ message: "connectionStatusId must be a positive integer" });
        }
        const failoverEvents = await failoverEventService.getAllFailoverEvents(connectionStatusId ?? undefined);
        res.json(failoverEvents);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getFailoverEventById = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid failover event id" });
        }
        const failoverEvent = await failoverEventService.getFailoverEventById(id);
        if (!failoverEvent) {
            return res.status(404).json({ message: "Failover event not found" });
        }
        res.json(failoverEvent);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const updateFailoverEvent = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid failover event id" });
        }
        const updates = {};
        if (req.body?.connectionStatusId !== undefined) {
            const connectionStatusId = parsePositiveInt(req.body.connectionStatusId);
            if (connectionStatusId === null) {
                return res.status(400).json({
                    message: "Valid connectionStatusId is required",
                });
            }
            updates.connectionStatusId = connectionStatusId;
        }
        if (req.body?.fromNode !== undefined) {
            updates.fromNode = normalizeString(req.body.fromNode) || null;
        }
        if (req.body?.toNode !== undefined) {
            updates.toNode = normalizeString(req.body.toNode) || null;
        }
        if (req.body?.reason !== undefined) {
            updates.reason = normalizeString(req.body.reason) || null;
        }
        if (req.body?.eventAt !== undefined) {
            const eventAt = parseOptionalDate(req.body.eventAt);
            if (eventAt.value === "invalid" || eventAt.value === null) {
                return res.status(400).json({ message: "eventAt must be a valid date" });
            }
            if (eventAt.value instanceof Date) {
                updates.eventAt = eventAt.value;
            }
        }
        if (req.body?.resolvedAt !== undefined) {
            const resolvedAt = parseOptionalDate(req.body.resolvedAt);
            if (resolvedAt.value === "invalid") {
                return res.status(400).json({ message: "resolvedAt must be a valid date" });
            }
            if (resolvedAt.value === null || resolvedAt.value instanceof Date) {
                updates.resolvedAt = resolvedAt.value;
            }
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const failoverEvent = await failoverEventService.updateFailoverEvent(id, updates);
        res.json(failoverEvent);
    }
    catch (error) {
        return handleFailoverEventWriteError(error, res);
    }
};
export const deleteFailoverEvent = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: "Invalid failover event id" });
        }
        await failoverEventService.deleteFailoverEvent(id);
        res.json({ message: "Failover event deleted successfully" });
    }
    catch (error) {
        return handleFailoverEventWriteError(error, res);
    }
};
//# sourceMappingURL=failover-event.controller.js.map