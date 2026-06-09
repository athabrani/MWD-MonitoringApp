import { connectSerialGateway, disconnectSerialGateway, getSerialGatewayStatus, listSerialPorts, } from "../services/serial-gateway.service.js";
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
const parseOptionalBoolean = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["1", "true", "yes", "on"].includes(normalized)) {
            return true;
        }
        if (["0", "false", "no", "off"].includes(normalized)) {
            return false;
        }
    }
    return null;
};
const parseOptionalText = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return typeof value === "string" ? value.trim() : null;
};
export const getSerialPorts = async (_req, res) => {
    try {
        const ports = await listSerialPorts();
        res.json({
            count: ports.length,
            data: ports,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const getSerialStatus = (_req, res) => {
    res.json(getSerialGatewayStatus());
};
export const connectSerialPort = async (req, res) => {
    try {
        const path = parseOptionalText(req.body?.path ?? req.body?.port);
        const baudRate = parsePositiveInt(req.body?.baudRate ?? req.body?.baud ?? process.env.SERIAL_BAUD_RATE);
        const sessionId = parsePositiveInt(req.body?.sessionId ??
            process.env.SERIAL_GATEWAY_SESSION_ID ??
            process.env.ESP_GATEWAY_SESSION_ID);
        const reconnectMs = parsePositiveInt(req.body?.reconnectMs ?? process.env.SERIAL_GATEWAY_RECONNECT_MS);
        const source = parseOptionalText(req.body?.source ?? process.env.SERIAL_GATEWAY_SOURCE);
        const transmitterId = parseOptionalText(req.body?.transmitterId ?? process.env.SERIAL_GATEWAY_TRANSMITTER_ID);
        const verbose = parseOptionalBoolean(req.body?.verbose ?? process.env.SERIAL_GATEWAY_VERBOSE);
        if (path === null || path === undefined) {
            return res.status(400).json({ message: "path is required" });
        }
        if (baudRate === null) {
            return res.status(400).json({ message: "baudRate must be a positive integer" });
        }
        if (sessionId === null) {
            return res.status(400).json({ message: "sessionId must be a positive integer" });
        }
        if (reconnectMs === null) {
            return res.status(400).json({ message: "reconnectMs must be a positive integer" });
        }
        if (source === null) {
            return res.status(400).json({ message: "source must be a string" });
        }
        if (transmitterId === null) {
            return res.status(400).json({ message: "transmitterId must be a string" });
        }
        if (verbose === null) {
            return res.status(400).json({ message: "verbose must be a boolean" });
        }
        const status = await connectSerialGateway({
            path,
            ...(baudRate !== null ? { baudRate } : {}),
            ...(sessionId !== null ? { sessionId } : {}),
            ...(reconnectMs !== null && reconnectMs !== undefined ? { reconnectMs } : {}),
            ...(source !== undefined ? { source } : {}),
            ...(transmitterId !== undefined ? { transmitterId } : {}),
            ...(verbose !== undefined ? { verbose } : {}),
        });
        const authUser = req.user;
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "serial.connect",
            details: `Connected serial gateway to ${path}`,
            metadata: {
                path,
                baudRate,
                sessionId,
                source,
                transmitterId,
            },
        });
        res.json({
            message: "Serial gateway connect requested",
            status,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
export const disconnectSerialPort = async (req, res) => {
    try {
        const status = await disconnectSerialGateway();
        const authUser = req.user;
        await createAuditLog({
            userId: authUser?.userId ?? null,
            action: "serial.disconnect",
            details: "Disconnected serial gateway",
            metadata: {
                status,
            },
        });
        res.json({
            message: "Serial gateway disconnected",
            status,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({ message });
    }
};
//# sourceMappingURL=serial-port.controller.js.map