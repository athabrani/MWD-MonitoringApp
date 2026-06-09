import type { Request, Response } from "express";
export declare const getClearDataTargets: (_req: Request, res: Response) => void;
export declare const getConfigurationBackupTargets: (_req: Request, res: Response) => void;
export declare const backupSessionData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const previewClearSessionData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const clearSessionData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const restoreSessionData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const backupConfiguration: (req: Request, res: Response) => Promise<void>;
export declare const restoreConfiguration: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=system-utility.controller.d.ts.map