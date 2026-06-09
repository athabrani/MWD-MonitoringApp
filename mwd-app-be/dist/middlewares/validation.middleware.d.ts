import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
export declare const validateBody: (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=validation.middleware.d.ts.map