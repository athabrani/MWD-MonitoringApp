import type { Request, Response } from "express";
export declare const getDepthTrackingState: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getDepthTrackingSamples: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateDepthTrackingState: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const recalculateDepthTracking: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=depth-tracking.controller.d.ts.map