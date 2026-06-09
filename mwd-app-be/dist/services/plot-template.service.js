import { prisma } from "../lib/prisma.js";
export const plotTemplateSelect = {
    id: true,
    name: true,
    description: true,
    config: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
};
const client = (db) => db;
export const createPlotTemplate = async (input, db = prisma) => {
    return await client(db).plotTemplate.create({
        data: input,
        select: plotTemplateSelect,
    });
};
export const getAllPlotTemplates = async (db = prisma) => {
    return await client(db).plotTemplate.findMany({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: plotTemplateSelect,
    });
};
export const getDefaultPlotTemplate = async (db = prisma) => {
    const rows = await client(db).plotTemplate.findMany({
        where: { isDefault: true },
        orderBy: { id: "asc" },
        take: 1,
        select: plotTemplateSelect,
    });
    return rows[0] ?? null;
};
export const getPlotTemplateById = async (id, db = prisma) => {
    return await client(db).plotTemplate.findUnique({
        where: { id },
        select: plotTemplateSelect,
    });
};
export const updatePlotTemplate = async (id, input, db = prisma) => {
    return await client(db).plotTemplate.update({
        where: { id },
        data: input,
        select: plotTemplateSelect,
    });
};
export const deletePlotTemplate = async (id, db = prisma) => {
    return await client(db).plotTemplate.delete({
        where: { id },
        select: plotTemplateSelect,
    });
};
//# sourceMappingURL=plot-template.service.js.map