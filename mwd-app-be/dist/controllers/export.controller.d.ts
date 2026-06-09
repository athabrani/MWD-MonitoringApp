import type { Request, Response } from 'express';
export declare const exportHistoricalData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportHistoricalLast24Hours: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportWitsData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportLasData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportSurveyData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportSurveyDataAsExcel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportSurveyDataAsPdf: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const exportPdfPlot: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getExportRecords: (_req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=export.controller.d.ts.map