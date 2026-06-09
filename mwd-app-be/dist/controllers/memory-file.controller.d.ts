import type { Request, Response } from "express";
export declare const importMemoryFile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMemoryFiles: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMemoryFileById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMemoryDataPoints: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteMemoryFile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const correlateMemoryFile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMemoryCorrelations: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=memory-file.controller.d.ts.map