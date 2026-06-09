import type { Request, Response } from "express";
export declare const getSurveyConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const upsertSurveyConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteSurveyConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=survey-config.controller.d.ts.map