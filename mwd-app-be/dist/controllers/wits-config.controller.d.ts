import type { Request, Response } from "express";
export declare const createWitsConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllWitsConfigs: (req: Request, res: Response) => Promise<void>;
export declare const getWitsConfigById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateWitsConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteWitsConfig: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=wits-config.controller.d.ts.map