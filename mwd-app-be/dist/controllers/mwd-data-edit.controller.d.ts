import type { Request, Response } from "express";
export declare const hideDepthRange: (req: Request, res: Response) => Promise<void>;
export declare const unhideDepthRange: (req: Request, res: Response) => Promise<void>;
export declare const deleteDepthRange: (req: Request, res: Response) => Promise<void>;
export declare const moveDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const previewMoveDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const copyDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const previewCopyDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const rescaleDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const previewRescaleDepthRange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getEditOperations: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=mwd-data-edit.controller.d.ts.map