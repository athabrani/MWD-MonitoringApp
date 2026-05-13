import { UserRole } from "@/types";
import { apiRequest } from "@/lib/api-client";

export type AdminRoleListItem = {
  id: number;
  name: UserRole | string;
  createdAt?: string;
  updatedAt?: string;
};

type BackendRole = {
  id?: number;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BackendRolesResponse = {
  value?: BackendRole[];
  Count?: number;
};

type RoleInput = {
  name: string;
};

function normalizeBackendRole(role: BackendRole): AdminRoleListItem {
  return {
    id: role.id ?? 0,
    name: role.name ?? "operator",
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function fetchAdminRoles(token: string): Promise<AdminRoleListItem[]> {
  const response = await apiRequest<BackendRolesResponse | BackendRole[]>("/api/roles", {
    method: "GET",
    token,
  });

  const roles = Array.isArray(response) ? response : response.value ?? [];
  return roles.map(normalizeBackendRole).filter((role) => role.id > 0);
}

export async function fetchAdminRoleById(
  token: string,
  roleId: number
): Promise<AdminRoleListItem> {
  const response = await apiRequest<BackendRole>(`/api/roles/${roleId}`, {
    method: "GET",
    token,
  });

  return normalizeBackendRole(response);
}

export async function createAdminRole(
  token: string,
  input: RoleInput
): Promise<AdminRoleListItem> {
  const response = await apiRequest<BackendRole>("/api/roles", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });

  return normalizeBackendRole(response);
}

export async function updateAdminRole(
  token: string,
  roleId: number,
  input: RoleInput
): Promise<AdminRoleListItem> {
  const response = await apiRequest<BackendRole>(`/api/roles/${roleId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });

  return normalizeBackendRole(response);
}

export async function deleteAdminRole(token: string, roleId: number): Promise<void> {
  await apiRequest<unknown>(`/api/roles/${roleId}`, {
    method: "DELETE",
    token,
  });
}
