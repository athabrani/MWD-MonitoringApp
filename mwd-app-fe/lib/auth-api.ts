import { User } from "@/types";
import { apiRequest } from "@/lib/api-client";
import { COOKIE_AUTH_SESSION_TOKEN } from "@/lib/security/storage";

type BackendRoleName = "admin" | "engineer" | "operator";

type BackendRole = {
  id?: number;
  name?: string;
};

type BackendUser = {
  id?: number | string;
  roleId?: number;
  username?: string;
  email?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  role?: BackendRole;
  roleName?: string;
  name?: string;
  fullName?: string;
};

type LoginResponse = {
  token?: string;
  accessToken?: string;
  user?: BackendUser;
  csrfToken?: string;
  authMode?: "cookie" | "token";
};

export type AuthSession = {
  token: string;
  user: User;
  csrfToken?: string | null;
  authMode: "cookie" | "token";
};

function normalizeRole(value: unknown): BackendRoleName {
  if (value === "admin" || value === "engineer" || value === "operator") {
    return value;
  }

  return "operator";
}

export function normalizeBackendUser(user: BackendUser): User {
  const username = user.username ?? user.email ?? String(user.id ?? "user");
  const role = normalizeRole(user.role?.name ?? user.roleName);

  return {
    id: String(user.id ?? username),
    username,
    email: user.email ?? "",
    role,
    fullName: user.fullName ?? user.name ?? username,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? undefined,
  };
}

export async function loginWithPassword(
  identifier: string,
  password: string
): Promise<AuthSession> {
  const response = await apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  if (response.authMode === "cookie") {
    if (!response.user) {
      throw new Error("Login response missing user.");
    }

    const currentUser = normalizeBackendUser(response.user);
    if (currentUser.isActive === false) {
      throw new Error("User account is inactive.");
    }

    return {
      token: COOKIE_AUTH_SESSION_TOKEN,
      user: currentUser,
      csrfToken: typeof response.csrfToken === "string" ? response.csrfToken : null,
      authMode: "cookie",
    };
  }

  const token =
    typeof response.token === "string"
      ? response.token.trim()
      : typeof response.accessToken === "string"
        ? response.accessToken.trim()
        : "";
  if (!token) {
    throw new Error("Login response did not include a token.");
  }

  const currentUser = await fetchCurrentUser(token);
  if (currentUser.isActive === false) {
    throw new Error("User account is inactive.");
  }

  return {
    token,
    user: currentUser,
    csrfToken: typeof response.csrfToken === "string" ? response.csrfToken : null,
    authMode: "token",
  };
}

export async function fetchCurrentUser(token?: string | null): Promise<User> {
  const user = await apiRequest<BackendUser>("/api/auth/me", {
    method: "GET",
    token: token ?? undefined,
  });

  return normalizeBackendUser(user);
}

export async function logoutFromBackend(token?: string | null): Promise<void> {
  await apiRequest<unknown>("/api/auth/logout", {
    method: "POST",
    token: token ?? undefined,
  });
}
