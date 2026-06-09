import { prisma } from "../lib/prisma.js";
import { projectSurveyStations, } from "../utils/survey-projection.js";
const surveyStationSelect = {
    id: true,
    sessionId: true,
    stationType: true,
    measuredDepth: true,
    inclination: true,
    azimuth: true,
    tvd: true,
    northing: true,
    easting: true,
    verticalSection: true,
    doglegSeverity: true,
    buildRate: true,
    turnRate: true,
    closureDistance: true,
    closureAzimuth: true,
    courseLength: true,
    verticalSectionAzimuth: true,
    source: true,
    notes: true,
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
const mwdSurveySelect = {
    id: true,
    measuredAt: true,
    depthMd: true,
    inclination: true,
    azimuth: true,
};
const client = (db) => db;
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
const toStringId = (value) => typeof value === "bigint" ? value.toString() : String(value ?? "");
const normalizeTrajectoryPoint = (row) => {
    if (typeof row !== "object" || row === null) {
        return null;
    }
    const record = row;
    const measuredDepth = toFiniteNumber(record.measuredDepth);
    const inclination = toFiniteNumber(record.inclination);
    const azimuth = toFiniteNumber(record.azimuth);
    if (measuredDepth === null || inclination === null || azimuth === null) {
        return null;
    }
    return {
        id: toStringId(record.id),
        stationType: typeof record.stationType === "string" ? record.stationType : "actual",
        measuredDepth,
        inclination,
        azimuth,
        tvd: toFiniteNumber(record.tvd),
        northing: toFiniteNumber(record.northing),
        easting: toFiniteNumber(record.easting),
        verticalSection: toFiniteNumber(record.verticalSection),
    };
};
export const getTrajectoryPlotData = async (input) => {
    const depthFilter = {};
    if (input.depthMin !== undefined) {
        depthFilter.gte = input.depthMin;
    }
    if (input.depthMax !== undefined) {
        depthFilter.lte = input.depthMax;
    }
    const whereBase = {
        sessionId: input.sessionId,
        ...(Object.keys(depthFilter).length > 0
            ? { measuredDepth: depthFilter }
            : {}),
    };
    const [actualRows, plannedRows] = await Promise.all([
        client(prisma).surveyStation.findMany({
            where: {
                ...whereBase,
                stationType: input.actualStationType ?? "actual",
            },
            orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
            select: surveyStationSelect,
        }),
        client(prisma).surveyStation.findMany({
            where: {
                ...whereBase,
                stationType: input.planStationType ?? "plan",
            },
            orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
            select: surveyStationSelect,
        }),
    ]);
    const actual = actualRows
        .map(normalizeTrajectoryPoint)
        .filter((row) => row !== null);
    const planned = plannedRows
        .map(normalizeTrajectoryPoint)
        .filter((row) => row !== null);
    return {
        sessionId: input.sessionId,
        actual,
        planned,
        planView: {
            actual: actual.map((point) => ({
                md: point.measuredDepth,
                x: point.easting,
                y: point.northing,
                tvd: point.tvd,
                verticalSection: point.verticalSection,
            })),
            planned: planned.map((point) => ({
                md: point.measuredDepth,
                x: point.easting,
                y: point.northing,
                tvd: point.tvd,
                verticalSection: point.verticalSection,
            })),
        },
        verticalSection: {
            actual: actual.map((point) => ({
                md: point.measuredDepth,
                x: point.verticalSection,
                y: point.tvd,
            })),
            planned: planned.map((point) => ({
                md: point.measuredDepth,
                x: point.verticalSection,
                y: point.tvd,
            })),
        },
    };
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
const getStationData = (input) => {
    const data = {};
    if (input.sessionId !== undefined) {
        data.sessionId = input.sessionId;
    }
    if (input.stationType !== undefined) {
        data.stationType = normalizeStationType(input.stationType);
    }
    for (const fieldName of [
        "measuredDepth",
        "inclination",
        "azimuth",
        "tvd",
        "northing",
        "easting",
        "verticalSectionAzimuth",
    ]) {
        if (input[fieldName] !== undefined) {
            data[fieldName] = input[fieldName] === null ? null : input[fieldName];
        }
    }
    if (input.source !== undefined) {
        data.source = input.source.trim() || "manual";
    }
    if (input.notes !== undefined) {
        data.notes = normalizeOptionalText(input.notes);
    }
    return data;
};
const stationRecordToProjectionInput = (station) => {
    const measuredDepth = toFiniteNumber(station.measuredDepth);
    const inclination = toFiniteNumber(station.inclination);
    const azimuth = toFiniteNumber(station.azimuth);
    if (measuredDepth === null || inclination === null || azimuth === null) {
        return null;
    }
    return {
        measuredDepth,
        inclination,
        azimuth,
        tvd: toFiniteNumber(station.tvd),
        northing: toFiniteNumber(station.northing),
        easting: toFiniteNumber(station.easting),
    };
};
const getVerticalSectionAzimuth = (stations, fallback) => {
    const explicit = stations
        .map((station) => toFiniteNumber(station.verticalSectionAzimuth))
        .find((value) => value !== null);
    return explicit ?? fallback;
};
export const recalculateSurveyStations = async (sessionId, stationType = "actual", verticalSectionAzimuth, db = prisma) => {
    const normalizedStationType = normalizeStationType(stationType);
    const stations = (await client(db).surveyStation.findMany({
        where: {
            sessionId,
            stationType: normalizedStationType,
        },
        orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
        select: surveyStationSelect,
    }));
    const projectionInputs = stations
        .map(stationRecordToProjectionInput)
        .filter((station) => station !== null);
    const resolvedVerticalSectionAzimuth = getVerticalSectionAzimuth(stations, verticalSectionAzimuth);
    const projection = projectSurveyStations(projectionInputs, resolvedVerticalSectionAzimuth !== undefined
        ? { verticalSectionAzimuth: resolvedVerticalSectionAzimuth }
        : {});
    const projectedByMeasuredDepth = new Map(projection.map((station) => [station.measuredDepth, station]));
    const updatedStations = [];
    for (const station of stations) {
        const measuredDepth = toFiniteNumber(station.measuredDepth);
        const projected = measuredDepth === null
            ? null
            : projectedByMeasuredDepth.get(measuredDepth) ?? null;
        if (!projected) {
            updatedStations.push(station);
            continue;
        }
        const updatedStation = await client(db).surveyStation.update({
            where: { id: station.id },
            data: projectionToStationUpdate(projected),
            select: surveyStationSelect,
        });
        updatedStations.push(updatedStation);
    }
    return updatedStations;
};
const projectionToStationUpdate = (projected) => {
    return {
        tvd: projected.tvd,
        northing: projected.northing,
        easting: projected.easting,
        verticalSection: projected.verticalSection,
        doglegSeverity: projected.doglegSeverity,
        buildRate: projected.buildRate,
        turnRate: projected.turnRate,
        closureDistance: projected.closureDistance,
        closureAzimuth: projected.closureAzimuth,
        courseLength: projected.courseLength,
        verticalSectionAzimuth: projected.verticalSectionAzimuth,
    };
};
export const createSurveyStation = async (input, db = prisma) => {
    const stationType = normalizeStationType(input.stationType);
    const station = await client(db).surveyStation.create({
        data: {
            ...getStationData(input),
            stationType,
            source: input.source?.trim() || "manual",
        },
        select: surveyStationSelect,
    });
    await recalculateSurveyStations(input.sessionId, stationType, toFiniteNumber(input.verticalSectionAzimuth) ?? undefined, db);
    return await getSurveyStationById(BigInt(String(station.id)), db);
};
export const getSurveyStations = async (filters, db = prisma) => {
    const where = {};
    if (filters.sessionId !== undefined) {
        where.sessionId = filters.sessionId;
    }
    if (filters.ownerUserId !== undefined) {
        where.session = { userId: filters.ownerUserId };
    }
    if (filters.stationType !== undefined) {
        where.stationType = normalizeStationType(filters.stationType);
    }
    return await client(db).surveyStation.findMany({
        where,
        orderBy: [{ stationType: "asc" }, { measuredDepth: "asc" }, { id: "asc" }],
        select: surveyStationSelect,
    });
};
export const getSurveyStationById = async (id, db = prisma) => {
    return await client(db).surveyStation.findUnique({
        where: { id },
        select: surveyStationSelect,
    });
};
export const updateSurveyStation = async (id, input, db = prisma) => {
    const existing = (await getSurveyStationById(id, db));
    if (!existing) {
        return null;
    }
    const stationType = normalizeStationType(input.stationType ?? existing.stationType);
    const sessionId = input.sessionId ?? Number(existing.sessionId);
    const updated = await client(db).surveyStation.update({
        where: { id },
        data: getStationData(input),
        select: surveyStationSelect,
    });
    await recalculateSurveyStations(sessionId, stationType, toFiniteNumber(input.verticalSectionAzimuth) ?? undefined, db);
    if (input.stationType !== undefined &&
        normalizeStationType(existing.stationType) !== stationType) {
        await recalculateSurveyStations(Number(existing.sessionId), normalizeStationType(existing.stationType), undefined, db);
    }
    return await getSurveyStationById(BigInt(String(updated.id)), db);
};
export const deleteSurveyStation = async (id, db = prisma) => {
    const existing = (await getSurveyStationById(id, db));
    if (!existing) {
        return null;
    }
    const deleted = await client(db).surveyStation.delete({
        where: { id },
        select: surveyStationSelect,
    });
    await recalculateSurveyStations(Number(existing.sessionId), normalizeStationType(existing.stationType), undefined, db);
    return deleted;
};
export const importSurveyFromMwdData = async (input, db = prisma) => {
    const stationType = normalizeStationType(input.stationType);
    const rows = (await client(db).mWDData.findMany({
        where: {
            sessionId: input.sessionId,
            isHidden: false,
            depthMd: { not: null },
            inclination: { not: null },
            azimuth: { not: null },
        },
        orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
        select: mwdSurveySelect,
    }));
    const stations = rows
        .map((row) => ({
        measuredDepth: toFiniteNumber(row.depthMd),
        inclination: toFiniteNumber(row.inclination),
        azimuth: toFiniteNumber(row.azimuth),
    }))
        .filter((row) => row.measuredDepth !== null &&
        row.inclination !== null &&
        row.azimuth !== null);
    if (input.replace) {
        await client(db).surveyStation.deleteMany({
            where: {
                sessionId: input.sessionId,
                stationType,
            },
        });
    }
    for (const station of stations) {
        await client(db).surveyStation.upsert({
            where: {
                sessionId_stationType_measuredDepth: {
                    sessionId: input.sessionId,
                    stationType,
                    measuredDepth: station.measuredDepth,
                },
            },
            update: {
                inclination: station.inclination,
                azimuth: station.azimuth,
                source: "mwd_data",
            },
            create: {
                sessionId: input.sessionId,
                stationType,
                measuredDepth: station.measuredDepth,
                inclination: station.inclination,
                azimuth: station.azimuth,
                source: "mwd_data",
            },
            select: surveyStationSelect,
        });
    }
    const data = await recalculateSurveyStations(input.sessionId, stationType, input.verticalSectionAzimuth, db);
    return {
        importedCount: stations.length,
        data,
    };
};
const splitCsvLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        const nextCharacter = line[index + 1];
        if (character === '"' && nextCharacter === '"') {
            current += '"';
            index += 1;
            continue;
        }
        if (character === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (character === "," && !inQuotes) {
            values.push(current.trim());
            current = "";
            continue;
        }
        current += character;
    }
    values.push(current.trim());
    return values;
};
const normalizeHeader = (value) => {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
};
const findCsvValue = (row, aliases) => {
    for (const alias of aliases) {
        const value = row[alias];
        if (value !== undefined && value !== "") {
            return value;
        }
    }
    return undefined;
};
export const parseWellPlanCsv = (csv) => {
    const lines = csv
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    if (lines.length === 0) {
        return { stations: [], errors: ["CSV is empty"] };
    }
    const header = splitCsvLine(lines[0] ?? "").map(normalizeHeader);
    const dataLines = lines.slice(1);
    const stations = [];
    const errors = [];
    for (const [index, line] of dataLines.entries()) {
        const values = splitCsvLine(line);
        const row = Object.fromEntries(header.map((key, headerIndex) => [key, values[headerIndex] ?? ""]));
        const measuredDepth = findCsvValue(row, [
            "md",
            "measureddepth",
            "depthmd",
            "depth",
        ]);
        const inclination = findCsvValue(row, ["inc", "inclination"]);
        const azimuth = findCsvValue(row, ["azi", "azm", "azimuth"]);
        const tvd = findCsvValue(row, ["tvd"]);
        const northing = findCsvValue(row, ["north", "northing", "ns"]);
        const easting = findCsvValue(row, ["east", "easting", "ew"]);
        if (toFiniteNumber(measuredDepth) === null ||
            toFiniteNumber(inclination) === null ||
            toFiniteNumber(azimuth) === null) {
            errors.push(`Row ${index + 2} must contain valid MD, inclination, and azimuth`);
            continue;
        }
        stations.push({
            sessionId: 0,
            measuredDepth: measuredDepth ?? "",
            inclination: inclination ?? "",
            azimuth: azimuth ?? "",
            ...(tvd !== undefined ? { tvd } : {}),
            ...(northing !== undefined ? { northing } : {}),
            ...(easting !== undefined ? { easting } : {}),
            stationType: "well_plan",
            source: "well_plan_csv",
        });
    }
    return { stations, errors };
};
export const importWellPlanCsv = async (input, db = prisma) => {
    const stationType = normalizeStationType(input.stationType, "well_plan");
    const parsed = parseWellPlanCsv(input.csv);
    const imported = [];
    if (input.replace) {
        await client(db).surveyStation.deleteMany({
            where: {
                sessionId: input.sessionId,
                stationType,
            },
        });
    }
    for (const station of parsed.stations) {
        const created = await client(db).surveyStation.upsert({
            where: {
                sessionId_stationType_measuredDepth: {
                    sessionId: input.sessionId,
                    stationType,
                    measuredDepth: station.measuredDepth,
                },
            },
            update: {
                inclination: station.inclination,
                azimuth: station.azimuth,
                tvd: station.tvd ?? null,
                northing: station.northing ?? null,
                easting: station.easting ?? null,
                source: "well_plan_csv",
            },
            create: {
                ...getStationData({
                    ...station,
                    sessionId: input.sessionId,
                    stationType,
                    source: "well_plan_csv",
                }),
            },
            select: surveyStationSelect,
        });
        imported.push(created);
    }
    const data = await recalculateSurveyStations(input.sessionId, stationType, input.verticalSectionAzimuth, db);
    return {
        importedCount: imported.length,
        skippedCount: parsed.errors.length,
        errors: parsed.errors,
        data,
    };
};
//# sourceMappingURL=survey.service.js.map