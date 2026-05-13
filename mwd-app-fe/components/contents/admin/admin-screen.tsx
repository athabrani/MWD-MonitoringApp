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
import { mockAuditLogs, mockSystemHealth } from "@/data/mock-data";
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

export const AdminPage: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const systemHealth = mockSystemHealth;
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [newUserForm, setNewUserForm] =
    useState<CreateAdminUserInput>(emptyNewUserForm);
  const [editUserForm, setEditUserForm] =
    useState<UpdateAdminUserInput>(emptyEditUserForm);
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoleListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [rolesError, setRolesError] = useState("");
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

  const loadAdminUsers = useCallback(async () => {
    if (!token) return;

    setUsersLoading(true);
    setUsersError("");

    try {
      const users = await fetchAdminUsers(token);
      setAdminUsers(users);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load backend users.";
      setUsersError(message);
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
      const message =
        error instanceof Error ? error.message : "Unable to load backend roles.";
      setRolesError(message);
    } finally {
      setRolesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === "admin" && token) {
      void loadAdminUsers();
      void loadAdminRoles();
    }
  }, [loadAdminRoles, loadAdminUsers, token, user?.role]);

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
          <Badge variant={systemHealth.serverStatus === "healthy" ? "default" : "destructive"}>
            {systemHealth.serverStatus}
          </Badge>
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-sm text-muted-foreground">Uptime</div>
          <div className="text-2xl font-bold">{systemHealth.uptime}%</div>
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
                      No backend users found.
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
                      No backend roles found.
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
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Audit Logs</h3>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(log.timestamp, "PPpp")}
                    </TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">System Health Dashboard</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm text-muted-foreground">Gateway Status</div>
                <Badge variant={systemHealth.gatewayStatus === "healthy" ? "default" : "destructive"}>
                  {systemHealth.gatewayStatus}
                </Badge>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm text-muted-foreground">Primary Feed</div>
                <Badge variant={systemHealth.primaryFeedStatus === "healthy" ? "default" : "destructive"}>
                  {systemHealth.primaryFeedStatus}
                </Badge>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm text-muted-foreground">Backup Feed</div>
                <Badge variant={systemHealth.backupFeedStatus === "healthy" ? "default" : "destructive"}>
                  {systemHealth.backupFeedStatus}
                </Badge>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm text-muted-foreground">Last Update</div>
                <div className="font-mono text-sm">
                  {format(systemHealth.lastUpdate, "PPpp")}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

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
