import type { NextFunction, Request, Response } from "express";
export type AuthenticatedUser = {
    userId: number;
    roleId: number;
    username: string;
    email: string;
    roleName: string;
    authSource?: "bearer" | "cookie";
};
export type AuthenticatedRequest = Request & {
    user?: AuthenticatedUser;
};
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const authorize: (...allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.middleware.d.ts.map