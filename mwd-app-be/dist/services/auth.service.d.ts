type JwtPayload = {
    userId: number;
    roleId: number;
    username: string;
    email: string;
    roleName: string;
};
type LoginRequestContext = {
    ip?: string | null;
    userAgent?: string | null;
};
export declare class LoginLockedError extends Error {
    retryAfterSeconds: number;
    constructor(retryAfterSeconds: number);
}
export declare const login: (identifier: string, password: string, context?: LoginRequestContext) => Promise<{
    token: string;
    user: {
        id: number;
        roleId: number;
        username: string;
        email: string;
        isActive: true;
        lastLoginAt: Date;
        role: {
            id: number;
            name: string;
        };
    };
} | null>;
export declare const verifyAccessToken: (token: string) => JwtPayload;
export declare const getCurrentUser: (userId: number) => Promise<{
    id: number;
    createdAt: Date;
    roleId: number;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    updatedAt: Date;
    role: {
        id: number;
        name: string;
    };
} | null>;
export {};
//# sourceMappingURL=auth.service.d.ts.map