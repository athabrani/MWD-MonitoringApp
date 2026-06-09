import type { Request, Response } from "express";
export declare const createMWDData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllMWDData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMWDDataById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateMWDData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteMWDData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=mwd-data.controller.d.ts.map