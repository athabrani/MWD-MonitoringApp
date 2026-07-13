import { User, UserRole } from "@/types";
import { apiRequest } from "@/lib/api-client";

export type AdminUserListItem = Pick<
  User,
  "id" | "username" | "email" | "role" | "fullName"
> & {
  roleId?: number;
  isActive?: boolean;
  lastLoginAt?: string;
};

export type CreateAdminUserInput = {
  username: string;
  email: string;
  password: string;
  roleId: number;
};

export type UpdateAdminUserInput = {
  username: string;
  email: string;
  password?: string;
  roleId: number;
  isActive?: boolean;
};

type BackendUserRole = {
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
  role?: BackendUserRole;
};

type BackendUsersResponse = {
  value?: BackendUser[];
  Count?: number;
};

function normalizeRole(value: unknown): UserRole {
  if (value === "admin" || value === "engineer" || value === "operator") {
    return value;
  }

  return "operator";
}

function normalizeBackendUser(user: BackendUser): AdminUserListItem {
  const username = user.username ?? user.email ?? String(user.id ?? "user");

  return {
    id: String(user.id ?? username),
    username,
    email: user.email ?? "",
    role: normalizeRole(user.role?.name),
    roleId: user.roleId ?? user.role?.id,
    fullName: username,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? undefined,
  };
}

export async function fetchAdminUsers(token: string): Promise<AdminUserListItem[]> {
  const response = await apiRequest<BackendUsersResponse | BackendUser[]>("/api/users", {
    method: "GET",
    token,
  });

  const users = Array.isArray(response) ? response : response.value ?? [];
  return users.map(normalizeBackendUser);
}

export async function fetchAdminUserById(
  token: string,
  userId: string
): Promise<AdminUserListItem> {
  const response = await apiRequest<BackendUser>(`/api/users/${userId}`, {
    method: "GET",
    token,
  });

  return normalizeBackendUser(response);
}

export async function createAdminUser(
  token: string,
  input: CreateAdminUserInput
): Promise<void> {
  await apiRequest<unknown>("/api/users", {
    method: "POST",
    token,
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      password: input.password,
      roleId: input.roleId,
    }),
  });
}

export async function updateAdminUser(
  token: string,
  userId: string,
  input: UpdateAdminUserInput
): Promise<void> {
  const payload: Record<string, string | number | boolean> = {
    username: input.username,
    email: input.email,
    roleId: input.roleId,
  };

  if (typeof input.isActive === "boolean") {
    payload.isActive = input.isActive;
  }

  if (input.password?.trim()) {
    payload.password = input.password;
  }

  await apiRequest<unknown>(`/api/users/${userId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(
  token: string,
  userId: string
): Promise<void> {
  await apiRequest<unknown>(`/api/users/${userId}`, {
    method: "DELETE",
    token,
  });
}
