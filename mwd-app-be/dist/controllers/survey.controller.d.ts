import type { Request, Response } from "express";
export declare const createSurveyStation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSurveyStations: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSurveyTrajectoryPlotData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSurveyStationById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateSurveyStation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteSurveyStation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recalculateSurveyStations: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const importSurveyFromMwdData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const importWellPlanCsv: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=survey.controller.d.ts.map