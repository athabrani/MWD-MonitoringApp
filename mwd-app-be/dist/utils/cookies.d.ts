import type { Request, Response } from "express";
export declare const parseCookies: (req: Request) => {
    [k: string]: string;
};
export declare const getAccessTokenFromCookie: (req: Request) => string;
export declare const getCsrfTokenFromCookie: (req: Request) => string;
export declare const setAuthCookies: (res: Response, input: {
    accessToken: string;
    csrfToken: string;
    maxAgeSeconds: number;
}) => void;
export declare const clearAuthCookies: (res: Response) => void;
//# sourceMappingURL=cookies.d.ts.map