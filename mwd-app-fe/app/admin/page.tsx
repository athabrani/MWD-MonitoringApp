"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Activity, FileText, RefreshCw, Trash2, UserPen, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { SystemHealthPanel } from "@/components/system-health-panel";
import { AdminAuditLogListItem, fetchAdminAuditLogs } from "@/lib/admin-audit-logs-api";
import {
  BackendReachability,
  checkBackendReachability,
} from "@/lib/admin-backend-health-api";
import { AdminRoleListItem, fetchAdminRoles } from "@/lib/admin-roles-api";
import {
  AdminUserListItem,
  createAdminUser,
  CreateAdminUserInput,
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUser,
  UpdateAdminUserInput,
} from "@/lib/admin-users-api";
import {
  defaultRolePageAccess,
  editablePageAccessRegistry,
  readRolePageAccess,
  RolePageAccessMap,
  saveRolePageAccess,
  subscribeRolePageAccess,
} from "@/lib/page-access";
import type { UserRole } from "@/types";

const emptyNewUserForm: CreateAdminUserInput = {
  username: "",
  email: "",
  password: "",
  roleId: 0,
};

const emptyEditUserForm: UpdateAdminUserInput = {
  username: "",
  email: "",
  password: "",
  roleId: 0,
  isActive: true,
};
const configurableRoles: Exclude<UserRole, "admin">[] = ["engineer", "operator"];

function formatAuditTimestamp(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return format(date, "PPpp");
}

function formatAuditMetadata(metadata: unknown) {
  if (metadata === null || typeof metadata === "undefined") return "";
  if (typeof metadata === "string") return metadata;

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function AuditLogDetails({ log }: { log: AdminAuditLogListItem }) {
  const metadata = formatAuditMetadata(log.metadata);

  if (!log.description && !metadata) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="max-w-xl space-y-2">
      {log.description ? (
        <p className="text-sm text-foreground">{log.description}</p>
      ) : null}
      {metadata ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Metadata</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-[11px]">
            {metadata}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function backendStatusLabel(status: BackendReachability["status"]) {
  if (status === "checking") return "Checking";
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  if (status === "auth-error") return "Auth Error";
  return "Error";
}

function backendStatusBadgeVariant(status: BackendReachability["status"]) {
  if (status === "online") return "secondary" as const;
  if (status === "offline" || status === "error") return "destructive" as const;
  return "outline" as const;
}

function backendStatusBadgeClassName(status: BackendReachability["status"]) {
  if (status === "online") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "auth-error") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return undefined;
}

function backendStatusDescription(status: BackendReachability["status"], errorMessage?: string) {
  if (status === "checking") return "Checking backend connection...";
  if (status === "online") return "Backend API reachable.";
  if (status === "offline") return errorMessage || "Backend API unreachable.";
  if (status === "auth-error") return "Backend reachable, but token/permission failed.";
  return errorMessage || "Backend returned an error.";
}

function formatHealthCheckedAt(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return format(date, "HH:mm:ss");
}

function formatApiLatency(health: BackendReachability) {
  if (health.status === "checking") return "Checking...";
  if (
    (health.status === "online" || health.status === "auth-error") &&
    typeof health.latencyMs === "number"
  ) {
    return `${health.latencyMs} ms`;
  }

  return "-";
}

function groupEditablePages() {
  return editablePageAccessRegistry.reduce<Record<string, typeof editablePageAccessRegistry>>((groups, page) => {
    groups[page.section] = [...(groups[page.section] ?? []), page];
    return groups;
  }, {});
}

export const AdminPage: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [accessDialogRole, setAccessDialogRole] = useState<Exclude<UserRole, "admin"> | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [newUserForm, setNewUserForm] =
    useState<CreateAdminUserInput>(emptyNewUserForm);
  const [editUserForm, setEditUserForm] =
    useState<UpdateAdminUserInput>(emptyEditUserForm);
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoleListItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogListItem[]>([]);
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMap>(() => readRolePageAccess());
  const [draftPageAccess, setDraftPageAccess] = useState<string[]>([]);
  const [backendReachability, setBackendReachability] = useState<BackendReachability>({
    status: "checking",
  });
  const [usersLoading, setUsersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [rolesError, setRolesError] = useState("");
  const [auditLogsError, setAuditLogsError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const canCreateBackendUser = useMemo(
    () =>
      Boolean(
        token &&
          newUserForm.username.trim() &&
          newUserForm.email.trim() &&
          newUserForm.password.trim() &&
          newUserForm.roleId
      ),
    [
      newUserForm.email,
      newUserForm.password,
      newUserForm.roleId,
      newUserForm.username,
      token,
    ]
  );

  const canUpdateBackendUser = useMemo(
    () =>
      Boolean(
        token &&
          selectedUser &&
          editUserForm.username.trim() &&
          editUserForm.email.trim() &&
          editUserForm.roleId
      ),
    [editUserForm.email, editUserForm.roleId, editUserForm.username, selectedUser, token]
  );
  const groupedEditablePages = useMemo(() => groupEditablePages(), []);

  useEffect(() => subscribeRolePageAccess(() => setRolePageAccess(readRolePageAccess())), []);

  const loadAdminUsers = useCallback(async () => {
    if (!token) return;

    setUsersLoading(true);
    setUsersError("");

    try {
      const users = await fetchAdminUsers(token);
      setAdminUsers(users);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load backend users.", error);
      }
      setUsersError("Gagal memuat data dari backend.");
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  const loadAdminRoles = useCallback(async () => {
    if (!token) return;

    setRolesLoading(true);
    setRolesError("");

    try {
      const roles = await fetchAdminRoles(token);
      setAdminRoles(roles);
      setNewUserForm((prev) => ({
        ...prev,
        roleId: prev.roleId || roles[0]?.id || 0,
      }));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load backend roles.", error);
      }
      setRolesError("Gagal memuat data dari backend.");
    } finally {
      setRolesLoading(false);
    }
  }, [token]);

  const loadAuditLogs = useCallback(async () => {
    if (!token) return;

    setAuditLogsLoading(true);
    setAuditLogsError("");

    try {
      const logs = await fetchAdminAuditLogs(token);
      setAuditLogs(logs);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load backend audit logs.", error);
      }
      setAuditLogsError(
        error instanceof Error
          ? `Gagal memuat audit logs dari backend: ${error.message}`
          : "Gagal memuat audit logs dari backend."
      );
    } finally {
      setAuditLogsLoading(false);
    }
  }, [token]);

  const loadBackendReachability = useCallback(async () => {
    if (!token) {
      setBackendReachability({
        status: "auth-error",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: "Missing admin auth token.",
      });
      return;
    }

    setBackendReachability((current) => ({
      ...current,
      status: "checking",
      errorMessage: undefined,
    }));

    const health = await checkBackendReachability(token);
    setBackendReachability(health);
  }, [token]);

  useEffect(() => {
    if (user?.role === "admin" && token) {
      void loadBackendReachability();
      void loadAdminUsers();
      void loadAdminRoles();
      void loadAuditLogs();
    }
  }, [loadAdminRoles, loadAdminUsers, loadAuditLogs, loadBackendReachability, token, user?.role]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Restoring admin session...</p>
      </Card>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This panel is only available for backend users with the admin role.
        </p>
      </Card>
    );
  }

  const resetCreateDialog = () => {
    setNewUserForm({
      ...emptyNewUserForm,
      roleId: adminRoles[0]?.id || 0,
    });
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddUserOpen(open);
    if (!open) resetCreateDialog();
  };

  const handleEditOpenChange = (open: boolean) => {
    setEditUserOpen(open);
    if (!open) {
      setSelectedUser(null);
      setEditUserForm(emptyEditUserForm);
    }
  };

  const openEditUser = (adminUser: AdminUserListItem) => {
    setSelectedUser(adminUser);
    setEditUserForm({
      username: adminUser.username,
      email: adminUser.email,
      password: "",
      roleId: adminUser.roleId || adminRoles.find((role) => role.name === adminUser.role)?.id || 0,
      isActive: adminUser.isActive ?? true,
    });
    setEditUserOpen(true);
  };

  const openDeleteUser = (adminUser: AdminUserListItem) => {
    setSelectedUser(adminUser);
    setDeleteUserOpen(true);
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !canCreateBackendUser) return;

    setCreatingUser(true);

    try {
      await createAdminUser(token, {
        username: newUserForm.username.trim(),
        email: newUserForm.email.trim(),
        password: newUserForm.password,
        roleId: newUserForm.roleId,
      });
      toast.success("User created successfully.");
      handleAddOpenChange(false);
      await loadAdminUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !selectedUser || !canUpdateBackendUser) return;

    setUpdatingUser(true);

    try {
      await updateAdminUser(token, selectedUser.id, {
        username: editUserForm.username.trim(),
        email: editUserForm.email.trim(),
        password: editUserForm.password,
        roleId: editUserForm.roleId,
        isActive: editUserForm.isActive,
      });
      toast.success("User updated successfully.");
      handleEditOpenChange(false);
      await loadAdminUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!token || !selectedUser) return;

    setDeletingUser(true);

    try {
      await deleteAdminUser(token, selectedUser.id);
      toast.success("User deleted successfully.");
      setDeleteUserOpen(false);
      setSelectedUser(null);
      await loadAdminUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete user.");
    } finally {
      setDeletingUser(false);
    }
  };

  const renderRoleSelectItems = () =>
    adminRoles.map((role) => (
      <SelectItem key={role.id} value={String(role.id)}>
        {role.name}
      </SelectItem>
    ));

  const openRoleAccessDialog = (role: Exclude<UserRole, "admin">) => {
    setAccessDialogRole(role);
    setDraftPageAccess(rolePageAccess[role]);
  };

  const handleAccessDialogOpenChange = (open: boolean) => {
    if (open) return;
    setAccessDialogRole(null);
    setDraftPageAccess([]);
  };

  const toggleDraftPageAccess = (pageKey: string) => {
    const page = editablePageAccessRegistry.find((item) => item.key === pageKey);
    if (!page) return;

    setDraftPageAccess((current) => {
      const currentPages = new Set(current);
      if (currentPages.has(page.key)) {
        currentPages.delete(page.key);
      } else {
        currentPages.add(page.key);
      }

      return Array.from(currentPages);
    });
  };

  const saveAccessDialog = () => {
    if (!accessDialogRole) return;

    const nextAccess: RolePageAccessMap = {
      ...rolePageAccess,
      [accessDialogRole]: draftPageAccess,
    };

    setRolePageAccess(nextAccess);
    saveRolePageAccess(nextAccess);
    toast.success(`${accessDialogRole} page access updated.`);
    handleAccessDialogOpenChange(false);
  };

  const resetRolePageAccess = () => {
    setRolePageAccess(defaultRolePageAccess);
    saveRolePageAccess(defaultRolePageAccess);
    toast.success("Role page access reset to frontend defaults.");
  };
  const draftAllowedPages = new Set(draftPageAccess);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">
          User management, system health, and audit logs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="mb-1 text-sm text-muted-foreground">Server Status</div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={backendStatusBadgeVariant(backendReachability.status)}
              className={backendStatusBadgeClassName(backendReachability.status)}
            >
              {backendStatusLabel(backendReachability.status)}
            </Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {backendStatusDescription(backendReachability.status, backendReachability.errorMessage)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-sm text-muted-foreground">API Latency</div>
          <div className="text-2xl font-bold">
            {formatApiLatency(backendReachability)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Last checked {formatHealthCheckedAt(backendReachability.lastCheckedAt)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-sm text-muted-foreground">Active Users</div>
          <div className="text-2xl font-bold">{adminUsers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-sm text-muted-foreground">Roles</div>
          <div className="text-2xl font-bold">{adminRoles.length}</div>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-2 size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="mr-2 size-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="mr-2 size-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="system">
            <Activity className="mr-2 size-4" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Backend User Management</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Users are loaded from the backend API and managed by admin role.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void loadAdminUsers();
                    void loadAdminRoles();
                  }}
                  disabled={usersLoading || rolesLoading}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Refresh
                </Button>
                <Button onClick={() => setAddUserOpen(true)} disabled={rolesLoading}>
                  Add User
                </Button>
              </div>
            </div>

            {usersError ? (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {usersError}
              </div>
            ) : null}
            {rolesError ? (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {rolesError}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Loading backend users...
                    </TableCell>
                  </TableRow>
                ) : null}

                {!usersLoading && adminUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Gagal memuat data dari backend.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!usersLoading
                  ? adminUsers.map((adminUser) => (
                      <TableRow key={adminUser.id}>
                        <TableCell className="font-medium">
                          {adminUser.fullName}
                        </TableCell>
                        <TableCell>{adminUser.email}</TableCell>
                        <TableCell>{adminUser.username}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {adminUser.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={adminUser.isActive ? "default" : "outline"}
                            className="capitalize"
                          >
                            {adminUser.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditUser(adminUser)}
                            >
                              <UserPen className="mr-2 size-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDeleteUser(adminUser)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Backend Roles</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Roles are loaded from GET /api/roles and used by user create/edit forms.
                </p>
              </div>
              <Button variant="outline" onClick={() => void loadAdminRoles()} disabled={rolesLoading}>
                <RefreshCw className="mr-2 size-4" />
                Refresh Roles
              </Button>
            </div>

            {rolesError ? (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {rolesError}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                      Loading backend roles...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!rolesLoading && adminRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                      Gagal memuat data dari backend.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!rolesLoading
                  ? adminRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>{role.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {role.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {role.updatedAt ? format(new Date(role.updatedAt), "PPpp") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>

            <div className="mt-8 border-t pt-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Role Page Access</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Frontend page-level access for navigation visibility and route guard. Backend endpoint permissions still need backend enforcement.
                  </p>
                </div>
                <Button variant="outline" onClick={resetRolePageAccess}>
                  Reset Defaults
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div>
                      <div className="font-medium capitalize">Admin</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Full access by default. No page-by-page selection required.
                      </p>
                    </div>
                    <Badge className="w-fit shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                      Full Access
                    </Badge>
                  </div>
                </div>

                {configurableRoles.map((role) => {
                  const allowedPages = new Set(rolePageAccess[role]);

                  return (
                    <div key={role} className="rounded-xl border border-border/80 bg-background/70 p-4">
                      <div className="flex h-full flex-col justify-between gap-4">
                        <div>
                          <div className="font-medium capitalize">{role}</div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {allowedPages.size} pages allowed for this role.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {Array.from(allowedPages).slice(0, 4).map((pageKey) => {
                              const page = editablePageAccessRegistry.find((item) => item.key === pageKey);
                              return page ? (
                                <Badge key={`${role}-${page.key}`} variant="outline" className="text-[10px]">
                                  {page.label}
                                </Badge>
                              ) : null;
                            })}
                            {allowedPages.size > 4 ? (
                              <Badge variant="outline" className="text-[10px]">
                                +{allowedPages.size - 4} more
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <Button variant="outline" className="w-full" onClick={() => openRoleAccessDialog(role)}>
                          Manage Access
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Audit Logs</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Loaded from GET /api/audit-logs for admin activity review.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void loadAuditLogs()}
                disabled={auditLogsLoading}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh Logs
              </Button>
            </div>

            {auditLogsError ? (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {auditLogsError}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module/Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : null}

                {!auditLogsLoading && !auditLogsError && auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No audit logs returned by the backend.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!auditLogsLoading
                  ? auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatAuditTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          {log.actor ? (
                            <span className="text-sm">{log.actor}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.action ? (
                            <Badge variant="secondary">{log.action}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.target ? (
                            <span className="font-mono text-xs">{log.target}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <AuditLogDetails log={log} />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <SystemHealthPanel
            mode="admin"
            title="System Health Dashboard"
            description="Admin troubleshooting view for backend API, hardware connection, serial gateway, ESP gateway, and realtime WebSocket state."
            backendReachability={backendReachability}
            onRefreshBackendReachability={loadBackendReachability}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(accessDialogRole)} onOpenChange={handleAccessDialogOpenChange}>
        <DialogContent className="flex max-h-[min(92dvh,calc(100vh-1rem))] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
          <DialogHeader className="shrink-0 px-4 py-3 pr-10 text-left sm:px-5 sm:py-4">
            <DialogTitle className="capitalize">
              {accessDialogRole ? `${accessDialogRole} Page Access` : "Manage Page Access"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(groupedEditablePages).map(([section, pages]) => (
                <section key={`dialog-${section}`} className="rounded-lg border border-border/90 bg-background/70 p-2.5 sm:p-3">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {section}
                  </div>
                  <div className="space-y-1">
                    {pages.map((page) => {
                      const active = draftAllowedPages.has(page.key);

                      return (
                        <div
                          key={`dialog-${page.key}`}
                          className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-muted/50"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => toggleDraftPageAccess(page.key)}
                          >
                            <span className="block truncate text-sm font-medium leading-tight">{page.label}</span>
                            <span className="block truncate text-[10px] leading-tight text-muted-foreground">{page.path}</span>
                          </button>
                          <Switch
                            checked={active}
                            onCheckedChange={() => toggleDraftPageAccess(page.key)}
                            aria-label={`Toggle ${page.label} access`}
                            className="shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/80 bg-background px-4 py-3 sm:px-5 [&>button]:w-full sm:[&>button]:w-auto">
            <Button type="button" variant="outline" onClick={() => handleAccessDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveAccessDialog} disabled={!accessDialogRole}>
              Save Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addUserOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Backend User</DialogTitle>
            <DialogDescription>
              Create a backend user account with a username, email, password, and role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-user-username">Username</Label>
                <Input
                  id="new-user-username"
                  value={newUserForm.username}
                  onChange={(event) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  placeholder="engineer2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newUserForm.email}
                  onChange={(event) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="engineer2@example.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Password</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={newUserForm.password}
                  onChange={(event) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Temporary password"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newUserForm.roleId ? String(newUserForm.roleId) : ""}
                  onValueChange={(value) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      roleId: Number(value),
                    }))
                  }
                  disabled={rolesLoading || adminRoles.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>{renderRoleSelectItems()}</SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canCreateBackendUser || creatingUser}>
                {creatingUser ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editUserOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Backend User</DialogTitle>
            <DialogDescription>
              Update username, email, role, status, or set a new password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-user-username">Username</Label>
                <Input
                  id="edit-user-username"
                  value={editUserForm.username}
                  onChange={(event) =>
                    setEditUserForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(event) =>
                    setEditUserForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-user-password">New Password</Label>
                <Input
                  id="edit-user-password"
                  type="password"
                  value={editUserForm.password ?? ""}
                  onChange={(event) =>
                    setEditUserForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editUserForm.roleId ? String(editUserForm.roleId) : ""}
                  onValueChange={(value) =>
                    setEditUserForm((prev) => ({
                      ...prev,
                      roleId: Number(value),
                    }))
                  }
                  disabled={rolesLoading || adminRoles.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>{renderRoleSelectItems()}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editUserForm.isActive ? "active" : "inactive"}
                onValueChange={(value) =>
                  setEditUserForm((prev) => ({
                    ...prev,
                    isActive: value === "active",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canUpdateBackendUser || updatingUser}>
                {updatingUser ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {selectedUser?.username ?? "the selected user"} from the backend.
              This action cannot be undone from the frontend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPage;
