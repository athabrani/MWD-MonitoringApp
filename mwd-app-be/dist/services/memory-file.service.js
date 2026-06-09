import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
const MEMORY_SAMPLE_LIMIT = 20;
const DEFAULT_MAX_DEPTH_DIFFERENCE = 0.5;
const DEFAULT_MAX_TIME_DIFFERENCE_MS = 60_000;
const CORRELATION_TARGET_FIELDS = MWD_MEASUREMENT_FIELDS.filter((fieldName) => fieldName !== "depthMd");
const fieldNameSet = new Set(MWD_MEASUREMENT_FIELDS);
const correlationFieldNameSet = new Set(CORRELATION_TARGET_FIELDS);
const fieldNameByNormalized = new Map(MWD_MEASUREMENT_FIELDS.map((fieldName) => [normalizeKey(fieldName), fieldName]));
const memoryFieldAliases = new Map([
    ["apwd", "mwdPressure"],
    ["apwdmemory", "mwdPressure"],
    ["apwdmem", "mwdPressure"],
    ["pwd", "mwdPressure"],
    ["mwdpress", "mwdPressure"],
    ["mwdpressure", "mwdPressure"],
    ["memorypressure", "mwdPressure"],
    ["pressurememory", "mwdPressure"],
    ["ecdmemory", "ecd2"],
    ["ecdmem", "ecd2"],
    ["ecdcalcfrommemory", "ecd2"],
    ["ecdcalcmemory", "ecd2"],
    ["ecdmemorysg", "ecd2"],
    ["annularpressure", "annularPressure"],
    ["pressureannular", "annularPressure"],
    ["pressureanular", "annularPressure"],
    ["borepressure", "borePressure"],
    ["pressurebore", "borePressure"],
    ["pumppress", "standpipePressure"],
    ["pumppressure", "standpipePressure"],
    ["standpipepressure", "standpipePressure"],
    ["mudweight", "mudWeight"],
    ["mw", "mudWeight"],
    ["rpmdownhole", "downholeRpm"],
    ["downholerpm", "downholeRpm"],
    ["shockaxial", "shockAxial"],
    ["shocklat", "shockLateral"],
    ["shocklateral", "shockLateral"],
    ["vibaxial", "vibrationAxial"],
    ["vibrationaxial", "vibrationAxial"],
    ["viblat", "vibrationLateral"],
    ["viblateral", "vibrationLateral"],
]);
const memoryFileSelect = {
    id: true,
    sessionId: true,
    importedById: true,
    fileName: true,
    source: true,
    depthField: true,
    measuredAtField: true,
    columns: true,
    fieldMappings: true,
    rowCount: true,
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
    importedBy: {
        select: {
            id: true,
            username: true,
            email: true,
        },
    },
};
const memoryPointSelect = {
    id: true,
    memoryFileId: true,
    sessionId: true,
    rowNumber: true,
    measuredAt: true,
    depthMd: true,
    values: true,
    createdAt: true,
};
const memoryCorrelationSelect = {
    id: true,
    memoryFileId: true,
    sessionId: true,
    correlatedById: true,
    mode: true,
    depthOffset: true,
    measuredAtOffsetMs: true,
    maxDepthDifference: true,
    maxTimeDifferenceMs: true,
    fieldMappings: true,
    affectedCount: true,
    createdAt: true,
};
const db = (client = prisma) => client;
function normalizeKey(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
const isRecord = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};
const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed.replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && "toString" in value) {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const parseDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value !== "string" && typeof value !== "number") {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
const parseMemoryScalar = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "boolean") {
        return value;
    }
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) {
        return numericValue;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value).trim();
};
const findFieldValue = (record, fieldName) => {
    if (!fieldName) {
        return undefined;
    }
    if (fieldName in record) {
        return record[fieldName];
    }
    const normalizedFieldName = normalizeKey(fieldName);
    const matchingKey = Object.keys(record).find((key) => normalizeKey(key) === normalizedFieldName);
    return matchingKey ? record[matchingKey] : undefined;
};
const findFirstFieldValue = (record, fieldName, aliases) => {
    const explicitValue = findFieldValue(record, fieldName);
    if (explicitValue !== undefined) {
        return explicitValue;
    }
    for (const alias of aliases) {
        const value = findFieldValue(record, alias);
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
};
const inferMeasurementField = (columnName) => {
    const normalized = normalizeKey(columnName);
    return memoryFieldAliases.get(normalized) ?? fieldNameByNormalized.get(normalized) ?? null;
};
const looksLikeMeasurementField = (value) => {
    return typeof value === "string" && fieldNameSet.has(value);
};
const looksLikeCorrelationField = (value) => {
    return typeof value === "string" && correlationFieldNameSet.has(value);
};
export const normalizeFieldMappings = (value) => {
    if (value === undefined || value === null || value === "") {
        return [];
    }
    const mappings = [];
    if (Array.isArray(value)) {
        for (const item of value) {
            if (!isRecord(item)) {
                throw new Error("fieldMappings array items must be objects");
            }
            const source = typeof item.source === "string"
                ? item.source.trim()
                : typeof item.column === "string"
                    ? item.column.trim()
                    : "";
            const target = typeof item.target === "string"
                ? item.target.trim()
                : typeof item.field === "string"
                    ? item.field.trim()
                    : "";
            if (!source || !looksLikeMeasurementField(target)) {
                throw new Error("fieldMappings must contain valid source and target");
            }
            mappings.push({ source, target });
        }
        return mappings;
    }
    if (!isRecord(value)) {
        throw new Error("fieldMappings must be an object or array");
    }
    for (const [left, right] of Object.entries(value)) {
        if (typeof right !== "string") {
            throw new Error("fieldMappings object values must be strings");
        }
        const leftIsField = looksLikeMeasurementField(left);
        const rightIsField = looksLikeMeasurementField(right);
        if (rightIsField) {
            mappings.push({ source: left, target: right });
            continue;
        }
        if (leftIsField) {
            mappings.push({ source: right, target: left });
            continue;
        }
        throw new Error(`Invalid field mapping ${left}: ${right}`);
    }
    return mappings;
};
const serializeMappings = (mappings) => {
    return mappings.map((mapping) => ({
        source: mapping.source,
        target: mapping.target,
    }));
};
const detectDelimiter = (line, delimiter) => {
    if (delimiter) {
        const normalized = delimiter.toLowerCase();
        if (normalized === "tab" || normalized === "\\t") {
            return "\t";
        }
        if (normalized === "space" || normalized === "whitespace") {
            return "whitespace";
        }
        return delimiter;
    }
    const counts = [
        { delimiter: ",", count: (line.match(/,/g) ?? []).length },
        { delimiter: "\t", count: (line.match(/\t/g) ?? []).length },
        { delimiter: ";", count: (line.match(/;/g) ?? []).length },
    ];
    counts.sort((left, right) => right.count - left.count);
    return counts[0]?.count ? counts[0].delimiter : "whitespace";
};
const splitDelimitedLine = (line, delimiter) => {
    if (delimiter === "whitespace") {
        return line.trim().split(/\s+/);
    }
    const values = [];
    let currentValue = "";
    let insideQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const nextChar = line[index + 1];
        if (char === "\"" && nextChar === "\"") {
            currentValue += "\"";
            index += 1;
            continue;
        }
        if (char === "\"") {
            insideQuotes = !insideQuotes;
            continue;
        }
        if (char === delimiter && !insideQuotes) {
            values.push(currentValue.trim());
            currentValue = "";
            continue;
        }
        currentValue += char;
    }
    values.push(currentValue.trim());
    return values;
};
const normalizeColumnName = (value, index) => {
    const trimmed = value.trim().replace(/^"|"$/g, "");
    return trimmed || `column_${index + 1}`;
};
const contentToRecords = (input) => {
    const content = input.content ?? "";
    const lines = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => {
        const trimmed = line.trim();
        return !!trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//");
    });
    if (lines.length === 0) {
        return { columns: [], records: [] };
    }
    const delimiter = detectDelimiter(lines[0]?.line ?? "", input.delimiter);
    const hasHeader = input.hasHeader !== false;
    const columns = hasHeader
        ? splitDelimitedLine(lines[0]?.line ?? "", delimiter).map(normalizeColumnName)
        : (input.columns ?? []).map(normalizeColumnName);
    if (columns.length === 0) {
        throw new Error("columns are required when hasHeader is false");
    }
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const records = dataLines.map(({ line, lineNumber }) => {
        const values = splitDelimitedLine(line, delimiter);
        const record = Object.fromEntries(columns.map((columnName, index) => [columnName, values[index] ?? ""]));
        return { rowNumber: lineNumber, record };
    });
    return { columns, records };
};
const rowsToRecords = (rows) => {
    const columns = Array.from(rows.reduce((columnSet, row) => {
        for (const key of Object.keys(row)) {
            columnSet.add(key);
        }
        return columnSet;
    }, new Set()));
    return {
        columns,
        records: rows.map((record, index) => ({ rowNumber: index + 1, record })),
    };
};
const buildPointValues = (record, mappings, depthField, measuredAtField) => {
    const depthValue = findFirstFieldValue(record, depthField, [
        "depthMd",
        "measuredDepth",
        "md",
        "depth",
        "bitDepth",
        "holeDepth",
    ]);
    const measuredAtValue = findFirstFieldValue(record, measuredAtField, [
        "measuredAt",
        "timestamp",
        "time",
        "dateTime",
        "datetime",
        "date",
    ]);
    const depthMd = toFiniteNumber(depthValue);
    const measuredAt = parseDate(measuredAtValue);
    const values = {};
    for (const [columnName, value] of Object.entries(record)) {
        const normalizedColumn = normalizeKey(columnName);
        const isDepthColumn = [
            depthField,
            "depthMd",
            "measuredDepth",
            "md",
            "depth",
            "bitDepth",
            "holeDepth",
        ]
            .filter((item) => typeof item === "string")
            .some((item) => normalizeKey(item) === normalizedColumn);
        const isMeasuredAtColumn = [
            measuredAtField,
            "measuredAt",
            "timestamp",
            "time",
            "dateTime",
            "datetime",
            "date",
        ]
            .filter((item) => typeof item === "string")
            .some((item) => normalizeKey(item) === normalizedColumn);
        if (isDepthColumn || isMeasuredAtColumn) {
            continue;
        }
        values[columnName] = parseMemoryScalar(value);
        const inferredField = inferMeasurementField(columnName);
        if (inferredField && values[inferredField] === undefined) {
            values[inferredField] = parseMemoryScalar(value);
        }
    }
    for (const mapping of mappings) {
        const mappedValue = findFieldValue(record, mapping.source);
        if (mappedValue !== undefined) {
            values[mapping.target] = parseMemoryScalar(mappedValue);
        }
    }
    const point = {
        rowNumber: 0,
        values,
    };
    if (depthMd !== null) {
        point.depthMd = depthMd;
    }
    if (measuredAt !== null) {
        point.measuredAt = measuredAt;
    }
    return point;
};
const parseMemoryPoints = (input) => {
    const mappings = normalizeFieldMappings(input.fieldMappings);
    const source = Array.isArray(input.rows) && input.rows.length > 0
        ? rowsToRecords(input.rows)
        : contentToRecords(input);
    const points = source.records
        .map(({ rowNumber, record }) => ({
        ...buildPointValues(record, mappings, input.depthField, input.measuredAtField),
        rowNumber,
    }))
        .filter((point) => {
        const hasPosition = point.depthMd !== undefined || point.measuredAt !== undefined;
        const hasValues = Object.values(point.values).some((value) => value !== null && value !== "");
        return hasPosition && hasValues;
    });
    if (points.length === 0) {
        throw new Error("No importable memory rows found");
    }
    return {
        columns: source.columns,
        mappings,
        points,
    };
};
const getMemoryPointNumericValue = (values, source) => {
    const directValue = values[source];
    if (directValue !== undefined) {
        return toFiniteNumber(directValue);
    }
    const normalizedSource = normalizeKey(source);
    const matchingKey = Object.keys(values).find((key) => normalizeKey(key) === normalizedSource);
    return matchingKey ? toFiniteNumber(values[matchingKey]) : null;
};
const buildUpdateValues = (values, mappings) => {
    const updateValues = {};
    for (const mapping of mappings) {
        if (!looksLikeCorrelationField(mapping.target)) {
            continue;
        }
        const mappedValue = getMemoryPointNumericValue(values, mapping.source);
        if (mappedValue !== null) {
            updateValues[mapping.target] = mappedValue;
        }
    }
    for (const fieldName of CORRELATION_TARGET_FIELDS) {
        if (updateValues[fieldName] !== undefined) {
            continue;
        }
        const fieldValue = getMemoryPointNumericValue(values, fieldName);
        if (fieldValue !== null) {
            updateValues[fieldName] = fieldValue;
        }
    }
    return updateValues;
};
const getRecordValues = (value) => {
    return isRecord(value) ? value : {};
};
const getBigIntId = (value) => {
    if (typeof value === "bigint") {
        return value;
    }
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return BigInt(value);
    }
    if (typeof value === "string" && value.trim()) {
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
const findNearestMwdDataByDepth = async (sessionId, targetDepth, maxDepthDifference, includeHidden) => {
    const rows = await db().mWDData.findMany({
        where: {
            sessionId,
            depthMd: {
                gte: targetDepth - maxDepthDifference,
                lte: targetDepth + maxDepthDifference,
            },
            ...(includeHidden ? {} : { isHidden: false }),
        },
        orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
        take: 20,
        select: {
            id: true,
            depthMd: true,
            measuredAt: true,
        },
    });
    return rows
        .map((row) => ({
        row,
        diff: Math.abs((toFiniteNumber(row.depthMd) ?? Number.POSITIVE_INFINITY) - targetDepth),
    }))
        .sort((left, right) => left.diff - right.diff)[0]?.row ?? null;
};
const findNearestMwdDataByTimestamp = async (sessionId, targetMeasuredAt, maxTimeDifferenceMs, includeHidden) => {
    const from = new Date(targetMeasuredAt.getTime() - maxTimeDifferenceMs);
    const to = new Date(targetMeasuredAt.getTime() + maxTimeDifferenceMs);
    const rows = await db().mWDData.findMany({
        where: {
            sessionId,
            measuredAt: {
                gte: from,
                lte: to,
            },
            ...(includeHidden ? {} : { isHidden: false }),
        },
        orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
        take: 40,
        select: {
            id: true,
            depthMd: true,
            measuredAt: true,
        },
    });
    return rows
        .map((row) => {
        const measuredAt = row.measuredAt instanceof Date ? row.measuredAt : null;
        return {
            row,
            diff: measuredAt
                ? Math.abs(measuredAt.getTime() - targetMeasuredAt.getTime())
                : Number.POSITIVE_INFINITY,
        };
    })
        .sort((left, right) => left.diff - right.diff)[0]?.row ?? null;
};
export const importMemoryFile = async (input) => {
    const parsed = parseMemoryPoints(input);
    const fileName = input.fileName?.trim() || `memory-${new Date().toISOString()}.csv`;
    const source = input.source?.trim() || "memory_file";
    const mappingJson = serializeMappings(parsed.mappings);
    const result = await db().$transaction(async (tx) => {
        const file = await db(tx).memoryFile.create({
            data: {
                sessionId: input.sessionId,
                importedById: input.importedById,
                fileName,
                source,
                depthField: input.depthField?.trim() || null,
                measuredAtField: input.measuredAtField?.trim() || null,
                columns: parsed.columns,
                fieldMappings: mappingJson,
                rowCount: parsed.points.length,
            },
            select: memoryFileSelect,
        });
        const memoryFileId = Number(file.id);
        const rowsToCreate = parsed.points.map((point) => ({
            memoryFileId,
            sessionId: input.sessionId,
            rowNumber: point.rowNumber,
            depthMd: point.depthMd ?? null,
            measuredAt: point.measuredAt ?? null,
            values: point.values,
        }));
        await db(tx).memoryDataPoint.createMany({
            data: rowsToCreate,
        });
        return file;
    });
    return {
        file: result,
        importedCount: parsed.points.length,
        fieldMappings: mappingJson,
        sample: parsed.points.slice(0, MEMORY_SAMPLE_LIMIT),
    };
};
export const getMemoryFiles = async (options = {}) => {
    return await db().memoryFile.findMany({
        where: {
            ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options.limit ?? 100,
        select: memoryFileSelect,
    });
};
export const getMemoryFileById = async (id) => {
    return await db().memoryFile.findUnique({
        where: { id },
        select: memoryFileSelect,
    });
};
export const getMemoryDataPoints = async (memoryFileId, options = {}) => {
    return await db().memoryDataPoint.findMany({
        where: { memoryFileId },
        orderBy: [{ rowNumber: "asc" }, { id: "asc" }],
        take: options.limit ?? 100,
        skip: options.skip ?? 0,
        select: memoryPointSelect,
    });
};
export const deleteMemoryFile = async (id) => {
    return await db().memoryFile.delete({
        where: { id },
        select: memoryFileSelect,
    });
};
export const getMemoryCorrelations = async (options = {}) => {
    return await db().memoryCorrelation.findMany({
        where: {
            ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
            ...(options.memoryFileId !== undefined ? { memoryFileId: options.memoryFileId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options.limit ?? 100,
        select: memoryCorrelationSelect,
    });
};
export const correlateMemoryFile = async (input) => {
    const memoryFile = await getMemoryFileById(input.memoryFileId);
    if (!memoryFile) {
        throw new Error("Memory file not found");
    }
    const mode = input.mode ?? "depth";
    const depthOffset = input.depthOffset ?? 0;
    const measuredAtOffsetMs = input.measuredAtOffsetMs ?? 0;
    const maxDepthDifference = input.maxDepthDifference ?? DEFAULT_MAX_DEPTH_DIFFERENCE;
    const maxTimeDifferenceMs = input.maxTimeDifferenceMs ?? DEFAULT_MAX_TIME_DIFFERENCE_MS;
    const storedMappings = memoryFile.fieldMappings;
    const mappings = input.fieldMappings !== undefined
        ? normalizeFieldMappings(input.fieldMappings)
        : normalizeFieldMappings(storedMappings);
    const points = await db().memoryDataPoint.findMany({
        where: { memoryFileId: input.memoryFileId },
        orderBy: [{ rowNumber: "asc" }, { id: "asc" }],
        select: memoryPointSelect,
    });
    const updatesById = new Map();
    let skippedCount = 0;
    const sample = [];
    for (const point of points) {
        const values = getRecordValues(point.values);
        const updateValues = buildUpdateValues(values, mappings);
        const updateFieldNames = Object.keys(updateValues);
        if (updateFieldNames.length === 0) {
            skippedCount += 1;
            continue;
        }
        let targetRow = null;
        const pointDepth = toFiniteNumber(point.depthMd);
        const pointMeasuredAt = point.measuredAt instanceof Date ? point.measuredAt : null;
        if (mode === "depth" && pointDepth !== null) {
            targetRow = await findNearestMwdDataByDepth(Number(memoryFile.sessionId), pointDepth + depthOffset, maxDepthDifference, input.includeHidden === true);
        }
        if (mode === "timestamp" && pointMeasuredAt !== null) {
            targetRow = await findNearestMwdDataByTimestamp(Number(memoryFile.sessionId), new Date(pointMeasuredAt.getTime() + measuredAtOffsetMs), maxTimeDifferenceMs, input.includeHidden === true);
        }
        const targetId = getBigIntId(targetRow?.id);
        if (!targetRow || targetId === null) {
            skippedCount += 1;
            continue;
        }
        const key = targetId.toString();
        const existingUpdate = updatesById.get(key);
        updatesById.set(key, {
            id: targetId,
            data: {
                ...(existingUpdate?.data ?? {}),
                ...updateValues,
            },
            sample: {
                memoryPointId: point.id,
                memoryDepthMd: point.depthMd,
                memoryMeasuredAt: point.measuredAt,
                mwdDataId: key,
                mwdDepthMd: targetRow.depthMd,
                mwdMeasuredAt: targetRow.measuredAt,
                fields: updateFieldNames,
            },
        });
        if (sample.length < MEMORY_SAMPLE_LIMIT) {
            sample.push({
                memoryPointId: point.id,
                memoryDepthMd: point.depthMd,
                memoryMeasuredAt: point.measuredAt,
                mwdDataId: key,
                mwdDepthMd: targetRow.depthMd,
                mwdMeasuredAt: targetRow.measuredAt,
                values: updateValues,
            });
        }
    }
    const updates = Array.from(updatesById.values());
    if (input.dryRun === true) {
        return {
            memoryFileId: input.memoryFileId,
            sessionId: memoryFile.sessionId,
            mode,
            dryRun: true,
            pointCount: points.length,
            matchedCount: updates.length,
            affectedCount: 0,
            skippedCount,
            depthOffset,
            measuredAtOffsetMs,
            maxDepthDifference,
            maxTimeDifferenceMs,
            fieldMappings: serializeMappings(mappings),
            sample,
        };
    }
    await db().$transaction(async (tx) => {
        for (const update of updates) {
            await db(tx).mWDData.update({
                where: { id: update.id },
                data: {
                    ...update.data,
                    editNote: `memory correlation: ${memoryFile.fileName}`,
                },
            });
        }
        await db(tx).memoryCorrelation.create({
            data: {
                memoryFileId: input.memoryFileId,
                sessionId: Number(memoryFile.sessionId),
                correlatedById: input.correlatedById,
                mode,
                depthOffset,
                measuredAtOffsetMs,
                maxDepthDifference,
                maxTimeDifferenceMs,
                fieldMappings: serializeMappings(mappings),
                affectedCount: updates.length,
            },
            select: memoryCorrelationSelect,
        });
    });
    return {
        memoryFileId: input.memoryFileId,
        sessionId: memoryFile.sessionId,
        mode,
        dryRun: false,
        pointCount: points.length,
        matchedCount: updates.length,
        affectedCount: updates.length,
        skippedCount,
        depthOffset,
        measuredAtOffsetMs,
        maxDepthDifference,
        maxTimeDifferenceMs,
        fieldMappings: serializeMappings(mappings),
        sample,
    };
};
//# sourceMappingURL=memory-file.service.js.map