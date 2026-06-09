import type { Request, Response } from "express";
export declare const getWitsDataValues: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getWitsAlarmEvents: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const acknowledgeWitsAlarm: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resolveWitsAlarm: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=wits-data.controller.d.ts.map