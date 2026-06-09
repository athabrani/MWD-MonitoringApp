import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
export type PlotTemplateInput = {
    name: string;
    description?: string | null;
    config: unknown;
    isDefault?: boolean;
};
export type PlotTemplateUpdateInput = Partial<PlotTemplateInput>;
export declare const plotTemplateSelect: {
    readonly id: true;
    readonly name: true;
    readonly description: true;
    readonly config: true;
    readonly isDefault: true;
    readonly createdAt: true;
    readonly updatedAt: true;
};
export declare const createPlotTemplate: (input: PlotTemplateInput, db?: PrismaDbClient) => Promise<unknown>;
export declare const getAllPlotTemplates: (db?: PrismaDbClient) => Promise<unknown[]>;
export declare const getDefaultPlotTemplate: (db?: PrismaDbClient) => Promise<{} | null>;
export declare const getPlotTemplateById: (id: number, db?: PrismaDbClient) => Promise<unknown>;
export declare const updatePlotTemplate: (id: number, input: PlotTemplateUpdateInput, db?: PrismaDbClient) => Promise<unknown>;
export declare const deletePlotTemplate: (id: number, db?: PrismaDbClient) => Promise<unknown>;
export {};
//# sourceMappingURL=plot-template.service.d.ts.map