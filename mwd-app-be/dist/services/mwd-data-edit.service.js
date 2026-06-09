import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
const measurementSelect = Object.fromEntries(MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]));
const db = (client = prisma) => client;
const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && "toString" in value) {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const normalizeDepthRange = (depthMin, depthMax) => {
    return {
        depthMin: Math.min(depthMin, depthMax),
        depthMax: Math.max(depthMin, depthMax),
    };
};
const buildRangeWhere = (input) => {
    const { depthMin, depthMax } = normalizeDepthRange(input.depthMin, input.depthMax);
    return {
        sessionId: input.sessionId,
        depthMd: {
            gte: depthMin,
            lte: depthMax,
        },
        ...(input.includeHidden ? {} : { isHidden: false }),
    };
};
const createEditOperation = async (client, input, operation, affectedCount, parameters) => {
    const { depthMin, depthMax } = normalizeDepthRange(input.depthMin, input.depthMax);
    return await db(client).mWDDataEditOperation.create({
        data: {
            sessionId: input.sessionId,
            editedById: input.editedById,
            operation,
            depthMin,
            depthMax,
            affectedCount,
            parameters: parameters ?? {},
            note: input.note ?? null,
        },
    });
};
const getDepthRangePreviewRows = async (input) => {
    return await db().mWDData.findMany({
        where: buildRangeWhere(input),
        orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
        take: 20,
        select: {
            id: true,
            measuredAt: true,
            depthMd: true,
            isHidden: true,
        },
    });
};
export const previewMoveDepthRange = async (input) => {
    const where = buildRangeWhere(input);
    const [affectedCount, rows] = await Promise.all([
        db().mWDData.count({ where }),
        getDepthRangePreviewRows(input),
    ]);
    return {
        operation: "move_depth",
        affectedCount,
        depthOffset: input.depthOffset,
        sample: rows.map((row) => {
            const depthMd = toFiniteNumber(row.depthMd);
            return {
                id: row.id,
                measuredAt: row.measuredAt,
                isHidden: row.isHidden,
                currentDepthMd: depthMd,
                newDepthMd: depthMd !== null ? depthMd + input.depthOffset : null,
            };
        }),
    };
};
export const previewCopyDepthRange = async (input) => {
    const where = buildRangeWhere(input);
    const [affectedCount, rows] = await Promise.all([
        db().mWDData.count({ where }),
        getDepthRangePreviewRows(input),
    ]);
    return {
        operation: "copy_depth",
        affectedCount,
        depthOffset: input.depthOffset,
        measuredAtOffsetMs: input.measuredAtOffsetMs ?? 0,
        sample: rows.map((row) => {
            const depthMd = toFiniteNumber(row.depthMd);
            const measuredAt = row.measuredAt instanceof Date ? row.measuredAt : null;
            return {
                id: row.id,
                measuredAt,
                copiedMeasuredAt: measuredAt !== null
                    ? new Date(measuredAt.getTime() + (input.measuredAtOffsetMs ?? 0))
                    : null,
                isHidden: row.isHidden,
                currentDepthMd: depthMd,
                copiedDepthMd: depthMd !== null ? depthMd + input.depthOffset : null,
            };
        }),
    };
};
export const previewRescaleDepthRange = async (input) => {
    const where = {
        ...buildRangeWhere(input),
        [input.field]: {
            not: null,
        },
    };
    const [affectedCount, rows] = await Promise.all([
        db().mWDData.count({ where }),
        db().mWDData.findMany({
            where,
            orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
            take: 20,
            select: {
                id: true,
                measuredAt: true,
                depthMd: true,
                isHidden: true,
                [input.field]: true,
            },
        }),
    ]);
    return {
        operation: "rescale",
        affectedCount,
        field: input.field,
        scaleFactor: input.scaleFactor,
        biasOffset: input.biasOffset,
        sample: rows.map((row) => {
            const currentValue = toFiniteNumber(row[input.field]);
            return {
                id: row.id,
                measuredAt: row.measuredAt,
                depthMd: row.depthMd,
                isHidden: row.isHidden,
                currentValue,
                newValue: currentValue !== null
                    ? currentValue * input.scaleFactor + input.biasOffset
                    : null,
            };
        }),
    };
};
export const setHiddenByDepthRange = async (input) => {
    const result = await db().$transaction(async (tx) => {
        const rangeInput = {
            ...input,
            includeHidden: input.hidden === false ? true : input.includeHidden === true,
        };
        const update = await db(tx).mWDData.updateMany({
            where: buildRangeWhere(rangeInput),
            data: {
                isHidden: input.hidden,
                hiddenAt: input.hidden ? new Date() : null,
                hiddenById: input.hidden ? input.editedById : null,
                editNote: input.note ?? null,
            },
        });
        await createEditOperation(tx, input, input.hidden ? "hide_depth_range" : "unhide_depth_range", update.count, { hidden: input.hidden });
        return update;
    });
    return { affectedCount: result.count };
};
export const deleteDepthRange = async (input) => {
    const result = await db().$transaction(async (tx) => {
        const deleted = await db(tx).mWDData.deleteMany({
            where: buildRangeWhere(input),
        });
        await createEditOperation(tx, input, "delete_depth_range", deleted.count);
        return deleted;
    });
    return { affectedCount: result.count };
};
export const moveDepthRange = async (input) => {
    const result = await db().$transaction(async (tx) => {
        const moved = await db(tx).mWDData.updateMany({
            where: buildRangeWhere(input),
            data: {
                depthMd: {
                    increment: input.depthOffset,
                },
                editNote: input.note ?? null,
            },
        });
        await createEditOperation(tx, input, "move_depth", moved.count, {
            depthOffset: input.depthOffset,
        });
        return moved;
    });
    return { affectedCount: result.count, depthOffset: input.depthOffset };
};
export const copyDepthRange = async (input) => {
    const result = await db().$transaction(async (tx) => {
        const rows = await db(tx).mWDData.findMany({
            where: buildRangeWhere(input),
            orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
            select: {
                sessionId: true,
                measuredAt: true,
                ...measurementSelect,
            },
        });
        const rowsToCreate = rows
            .map((row) => {
            const depthMd = toFiniteNumber(row.depthMd);
            if (depthMd === null || !(row.measuredAt instanceof Date)) {
                return null;
            }
            const data = {
                sessionId: row.sessionId,
                measuredAt: new Date(row.measuredAt.getTime() + (input.measuredAtOffsetMs ?? 0)),
                depthMd: depthMd + input.depthOffset,
                isHidden: false,
                hiddenAt: null,
                hiddenById: null,
                editNote: input.note ?? null,
            };
            for (const fieldName of MWD_MEASUREMENT_FIELDS) {
                if (fieldName === "depthMd") {
                    continue;
                }
                data[fieldName] = row[fieldName] ?? null;
            }
            return data;
        })
            .filter((row) => row !== null);
        const copied = rowsToCreate.length > 0
            ? await db(tx).mWDData.createMany({ data: rowsToCreate })
            : { count: 0 };
        await createEditOperation(tx, input, "copy_depth", copied.count, {
            depthOffset: input.depthOffset,
            measuredAtOffsetMs: input.measuredAtOffsetMs ?? 0,
        });
        return copied;
    });
    return {
        affectedCount: result.count,
        depthOffset: input.depthOffset,
        measuredAtOffsetMs: input.measuredAtOffsetMs ?? 0,
    };
};
export const rescaleDepthRange = async (input) => {
    const result = await db().$transaction(async (tx) => {
        const rows = await db(tx).mWDData.findMany({
            where: {
                ...buildRangeWhere(input),
                [input.field]: {
                    not: null,
                },
            },
            select: {
                id: true,
                [input.field]: true,
            },
        });
        let affectedCount = 0;
        for (const row of rows) {
            const id = row.id;
            const currentValue = toFiniteNumber(row[input.field]);
            if (typeof id !== "bigint" || currentValue === null) {
                continue;
            }
            await db(tx).mWDData.update({
                where: { id },
                data: {
                    [input.field]: currentValue * input.scaleFactor + input.biasOffset,
                    editNote: input.note ?? null,
                },
            });
            affectedCount += 1;
        }
        await createEditOperation(tx, input, "rescale", affectedCount, {
            field: input.field,
            scaleFactor: input.scaleFactor,
            biasOffset: input.biasOffset,
        });
        return { count: affectedCount };
    });
    return {
        affectedCount: result.count,
        field: input.field,
        scaleFactor: input.scaleFactor,
        biasOffset: input.biasOffset,
    };
};
export const getEditOperations = async (options = {}) => {
    return await db().mWDDataEditOperation.findMany({
        where: {
            ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options.limit ?? 100,
    });
};
//# sourceMappingURL=mwd-data-edit.service.js.map