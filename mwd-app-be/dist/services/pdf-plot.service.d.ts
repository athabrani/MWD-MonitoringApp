type PdfPlotInput = {
    sessionId: number;
    sessionCode: string;
    wellName?: string | null;
    rigName?: string | null;
    templateId?: number;
    template?: Record<string, unknown>;
    depthMin?: number;
    depthMax?: number;
};
export declare const buildPdfPlot: (input: PdfPlotInput) => Promise<{
    content: Buffer<ArrayBuffer>;
    fileName: string;
    rowCount: number;
    surveyRowCount: number;
    pageCount: number;
}>;
export {};
//# sourceMappingURL=pdf-plot.service.d.ts.map