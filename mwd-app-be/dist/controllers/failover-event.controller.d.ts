import type { Request, Response } from "express";
export declare const createFailoverEvent: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllFailoverEvents: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getFailoverEventById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateFailoverEvent: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteFailoverEvent: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=failover-event.controller.d.ts.map