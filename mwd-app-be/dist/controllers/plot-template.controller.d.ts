import type { Request, Response } from "express";
export declare const createPlotTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllPlotTemplates: (_req: Request, res: Response) => Promise<void>;
export declare const getDefaultPlotTemplate: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPlotTemplateById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updatePlotTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deletePlotTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=plot-template.controller.d.ts.map