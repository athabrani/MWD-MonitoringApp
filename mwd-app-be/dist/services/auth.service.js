import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { createAuditLog } from "./audit-log.service.js";
import { normalizeRoleName } from "../utils/roles.js";
const failedLoginStore = new Map();
const LOGIN_FAILURE_WINDOW_MS = Number(process.env.LOGIN_FAILURE_WINDOW_MS ?? 15 * 60 * 1000);
const LOGIN_LOCKOUT_MS = Number(process.env.LOGIN_LOCKOUT_MS ?? 15 * 60 * 1000);
const LOGIN_MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? 5);
export class LoginLockedError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super("Too many failed login attempts. Please try again later.");
        this.name = "LoginLockedError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
};
const getLoginKey = (identifier) => identifier.trim().toLowerCase();
const getRetryAfterSeconds = (lockedUntil) => Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
const getFailedEntry = (key, now) => {
    const entry = failedLoginStore.get(key);
    if (!entry) {
        return { count: 0, firstFailedAt: now };
    }
    if (entry.lockedUntil && entry.lockedUntil > now) {
        return entry;
    }
    if (entry.firstFailedAt + LOGIN_FAILURE_WINDOW_MS <= now) {
        failedLoginStore.delete(key);
        return { count: 0, firstFailedAt: now };
    }
    return entry;
};
const cleanupFailedLoginStore = (now) => {
    if (failedLoginStore.size < 10_000) {
        return;
    }
    for (const [key, entry] of failedLoginStore.entries()) {
        const expiresAt = entry.lockedUntil ?? entry.firstFailedAt + LOGIN_FAILURE_WINDOW_MS;
        if (expiresAt <= now) {
            failedLoginStore.delete(key);
        }
        if (failedLoginStore.size < 8_000) {
            break;
        }
    }
};
const recordLoginFailure = async (identifier, user, reason, context) => {
    const now = Date.now();
    const key = getLoginKey(identifier);
    const entry = getFailedEntry(key, now);
    const nextCount = entry.count + 1;
    const shouldLock = nextCount >= LOGIN_MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? now + LOGIN_LOCKOUT_MS : entry.lockedUntil;
    failedLoginStore.set(key, {
        count: nextCount,
        firstFailedAt: entry.firstFailedAt,
        ...(lockedUntil ? { lockedUntil } : {}),
    });
    cleanupFailedLoginStore(now);
    await createAuditLog({
        userId: user?.id ?? null,
        action: "login.failed",
        details: `Failed login attempt for ${identifier}`,
        metadata: {
            identifier,
            username: user?.username ?? null,
            email: user?.email ?? null,
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            reason,
            attemptCount: nextCount,
            lockedUntil: lockedUntil ? new Date(lockedUntil).toISOString() : null,
        },
    });
    if (shouldLock && lockedUntil) {
        throw new LoginLockedError(getRetryAfterSeconds(lockedUntil));
    }
};
const clearLoginFailures = (identifier) => {
    failedLoginStore.delete(getLoginKey(identifier));
};
export const login = async (identifier, password, context = {}) => {
    const now = Date.now();
    const key = getLoginKey(identifier);
    const failedEntry = getFailedEntry(key, now);
    if (failedEntry.lockedUntil && failedEntry.lockedUntil > now) {
        await createAuditLog({
            action: "login.locked",
            details: `Blocked locked login attempt for ${identifier}`,
            metadata: {
                identifier,
                ip: context.ip ?? null,
                userAgent: context.userAgent ?? null,
                lockedUntil: new Date(failedEntry.lockedUntil).toISOString(),
            },
        });
        throw new LoginLockedError(getRetryAfterSeconds(failedEntry.lockedUntil));
    }
    const user = await prisma.user.findFirst({
        where: {
            OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
        },
        include: {
            role: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    if (!user) {
        await recordLoginFailure(identifier, null, "invalid_credentials", context);
        return null;
    }
    if (!user.isActive) {
        await recordLoginFailure(identifier, user, "inactive_user", context);
        return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        await recordLoginFailure(identifier, user, "invalid_credentials", context);
        return null;
    }
    clearLoginFailures(identifier);
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    await createAuditLog({
        userId: user.id,
        action: "login",
        details: `User ${user.username} logged in`,
        metadata: {
            username: user.username,
            email: user.email,
            role: user.role.name,
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
        },
    });
    const payload = {
        userId: user.id,
        roleId: user.roleId,
        username: user.username,
        email: user.email,
        roleName: normalizeRoleName(user.role.name),
    };
    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "1d" });
    return {
        token,
        user: {
            id: user.id,
            roleId: user.roleId,
            username: user.username,
            email: user.email,
            isActive: user.isActive,
            lastLoginAt: new Date(),
            role: user.role,
        },
    };
};
export const verifyAccessToken = (token) => {
    return jwt.verify(token, getJwtSecret());
};
export const getCurrentUser = async (userId) => {
    return await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            roleId: true,
            username: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            role: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
};
//# sourceMappingURL=auth.service.js.map