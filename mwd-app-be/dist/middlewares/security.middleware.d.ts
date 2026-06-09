import type { NextFunction, Request, Response } from "express";
type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyPrefix?: string;
    message?: string;
};
export declare const securityHeaders: (_req: Request, res: Response, next: NextFunction) => void;
export declare const rateLimit: (options: RateLimitOptions) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=security.middleware.d.ts.map