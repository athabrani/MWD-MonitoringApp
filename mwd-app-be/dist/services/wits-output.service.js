import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
const witsOutputMessageSelect = {
    id: true,
    sessionId: true,
    targetPort: true,
    witsId: true,
    measuredAt: true,
    depthMd: true,
    value: true,
    payload: true,
    status: true,
    reason: true,
    sentAt: true,
    createdAt: true,
    updatedAt: true,
    session: {
        select: {
            id: true,
            sessionCode: true,
            wellName: true,
            rigName: true,
            userId: true,
        },
    },
};
const db = (client = prisma) => client;
const measurementSelect = Object.fromEntries(MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]));
const measurementFieldSet = new Set(MWD_MEASUREMENT_FIELDS);
const toFiniteNumber = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && "toString" in value) {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const normalizeTargetPort = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "rig" ||
        normalized === "rig_port" ||
        normalized === "rig_wits" ||
        normalized === "rig_wits_port") {
        return "rig";
    }
    return null;
};
const normalizeStatus = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return ["queued", "sent", "failed", "skipped"].includes(normalized)
        ? normalized
        : null;
};
const formatWitsValue = (value, decimalPlaces) => {
    const clampedDecimals = Math.max(0, Math.min(decimalPlaces, 8));
    return value.toFixed(clampedDecimals);
};
export const buildWitsOutputPayload = (witsId, value, decimalPlaces) => {
    return `&&\r\n${witsId}${formatWitsValue(value, decimalPlaces)}\r\n!!\r\n`;
};
const getTargetPorts = (config) => {
    const ports = [];
    if (config.sendToRigWitsPort) {
        ports.push("rig");
    }
    return ports;
};
export const queueWitsOutputForConfig = async (input) => {
    const client = db(input.db);
    const numericValue = toFiniteNumber(input.value);
    const numericDepth = toFiniteNumber(input.depthMd);
    const ports = getTargetPorts(input.config);
    const createdMessages = [];
    const skippedMessages = [];
    if (numericValue === null || ports.length === 0) {
        return {
            queuedCount: 0,
            skippedCount: 0,
            messages: [],
        };
    }
    for (const targetPort of ports) {
        const payload = buildWitsOutputPayload(input.config.witsId, numericValue, input.config.decimalPlaces);
        const lastMessage = input.config.doNotRepeat
            ? await client.witsOutputMessage.findFirst({
                where: {
                    sessionId: input.sessionId,
                    targetPort,
                    witsId: input.config.witsId,
                    status: {
                        in: ["queued", "sent"],
                    },
                },
                orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
                select: {
                    payload: true,
                },
            })
            : null;
        const repeated = lastMessage?.payload === payload;
        const message = await client.witsOutputMessage.create({
            data: {
                sessionId: input.sessionId,
                targetPort,
                witsId: input.config.witsId,
                measuredAt: input.measuredAt,
                depthMd: numericDepth,
                value: numericValue,
                payload,
                status: repeated ? "skipped" : "queued",
                reason: repeated ? "do_not_repeat" : input.reason ?? null,
            },
            select: witsOutputMessageSelect,
        });
        if (repeated) {
            skippedMessages.push(message);
        }
        else {
            createdMessages.push(message);
        }
    }
    return {
        queuedCount: createdMessages.length,
        skippedCount: skippedMessages.length,
        messages: [...createdMessages, ...skippedMessages],
    };
};
export const queueWitsOutputsForConfigs = async (input) => {
    const messages = [];
    let queuedCount = 0;
    let skippedCount = 0;
    for (const item of input.values) {
        const queueInput = {
            sessionId: input.sessionId,
            measuredAt: input.measuredAt,
            depthMd: input.depthMd,
            value: item.value,
            config: item.config,
        };
        if (input.reason !== undefined) {
            queueInput.reason = input.reason;
        }
        if (input.db !== undefined) {
            queueInput.db = input.db;
        }
        const result = await queueWitsOutputForConfig(queueInput);
        queuedCount += result.queuedCount;
        skippedCount += result.skippedCount;
        messages.push(...result.messages);
    }
    return {
        queuedCount,
        skippedCount,
        messages,
    };
};
export const getWitsOutputMessages = async (filters) => {
    const where = {};
    if (filters.sessionId !== undefined) {
        where.sessionId = filters.sessionId;
    }
    if (filters.ownerUserId !== undefined) {
        where.session = { userId: filters.ownerUserId };
    }
    if (filters.targetPort !== undefined) {
        const targetPort = normalizeTargetPort(filters.targetPort);
        if (targetPort) {
            where.targetPort = targetPort;
        }
    }
    if (filters.status !== undefined) {
        const status = normalizeStatus(filters.status);
        if (status) {
            where.status = status;
        }
    }
    if (filters.witsId !== undefined) {
        where.witsId = filters.witsId;
    }
    return await db().witsOutputMessage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: Math.max(1, Math.min(filters.limit ?? 500, 5000)),
        select: witsOutputMessageSelect,
    });
};
export const updateWitsOutputStatus = async (id, status, reason) => {
    return await db().witsOutputMessage.update({
        where: { id },
        data: {
            status,
            ...(status === "sent" ? { sentAt: new Date() } : {}),
            ...(reason !== undefined ? { reason } : {}),
        },
        select: witsOutputMessageSelect,
    });
};
export const queueWitsOutputFromLatestMwdData = async (sessionId) => {
    const latestData = await db().mWDData.findFirst({
        where: {
            sessionId,
            isHidden: false,
        },
        orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
        select: {
            id: true,
            measuredAt: true,
            ...measurementSelect,
        },
    });
    if (!latestData) {
        return {
            queuedCount: 0,
            skippedCount: 0,
            messages: [],
            source: null,
        };
    }
    const configs = await db().witsConfig.findMany({
        where: {
            sendToRigWitsPort: true,
            mappedField: {
                not: null,
            },
        },
        select: {
            id: true,
            witsId: true,
            name: true,
            mappedField: true,
            decimalPlaces: true,
            sendToRigWitsPort: true,
            doNotRepeat: true,
        },
    });
    const values = configs
        .filter((config) => {
        return (typeof config.mappedField === "string" &&
            measurementFieldSet.has(config.mappedField));
    })
        .map((config) => ({
        config,
        value: latestData[config.mappedField],
    }));
    const measuredAt = latestData.measuredAt instanceof Date ? latestData.measuredAt : new Date();
    const result = await queueWitsOutputsForConfigs({
        sessionId,
        measuredAt,
        depthMd: latestData.depthMd,
        values,
        reason: "generated_from_latest_mwd_data",
    });
    return {
        ...result,
        source: {
            mwdDataId: latestData.id,
            measuredAt,
            depthMd: latestData.depthMd,
        },
    };
};
export const isValidTargetPort = (value) => normalizeTargetPort(value) !== null;
export const isValidStatus = (value) => normalizeStatus(value) !== null;
//# sourceMappingURL=wits-output.service.js.map