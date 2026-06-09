import type { Request, Response } from "express";
export declare const createConnectionStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllConnectionStatuses: (_req: Request, res: Response) => Promise<void>;
export declare const getConnectionStatusById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateConnectionStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteConnectionStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=connection-status.controller.d.ts.map