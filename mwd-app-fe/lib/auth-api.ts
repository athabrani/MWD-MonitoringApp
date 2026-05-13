import { User } from "@/types";
import { apiRequest } from "@/lib/api-client";

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
  user?: BackendUser;
};

export type AuthSession = {
  token: string;
  user: User;
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

  if (!response.token || !response.user) {
    throw new Error("Login response did not include a token and user profile.");
  }

  return {
    token: response.token,
    user: normalizeBackendUser(response.user),
  };
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const user = await apiRequest<BackendUser>("/api/auth/me", {
    method: "GET",
    token,
  });

  return normalizeBackendUser(user);
}
