import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Activity, FileText, Shield } from 'lucide-react';
import { mockUsers, mockAuditLogs, mockSystemHealth } from '@/data/mock-data';
import { format } from 'date-fns';

export const AdminPage: React.FC = () => {
  const systemHealth = mockSystemHealth;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">
          User management, system health, and audit logs
        </p>
      </div>

      {/* System Health */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Server Status</div>
          <Badge variant={systemHealth.serverStatus === 'healthy' ? 'default' : 'destructive'}>
            {systemHealth.serverStatus}
          </Badge>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Uptime</div>
          <div className="text-2xl font-bold">{systemHealth.uptime}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Active Users</div>
          <div className="text-2xl font-bold">{systemHealth.activeUsers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Error Rate</div>
          <div className="text-2xl font-bold">{systemHealth.errorRate}%</div>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="size-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="size-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="system">
            <Activity className="size-4 mr-2" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">User Management</h3>
              <Button>Add User</Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Audit Logs</h3>
            
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
                {mockAuditLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(log.timestamp, 'PPpp')}
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
            <h3 className="font-semibold mb-4">System Health Dashboard</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Gateway Status</div>
                <Badge variant={systemHealth.gatewayStatus === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealth.gatewayStatus}
                </Badge>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Primary Feed</div>
                <Badge variant={systemHealth.primaryFeedStatus === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealth.primaryFeedStatus}
                </Badge>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Backup Feed</div>
                <Badge variant={systemHealth.backupFeedStatus === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealth.backupFeedStatus}
                </Badge>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Last Update</div>
                <div className="text-sm font-mono">{format(systemHealth.lastUpdate, 'PPpp')}</div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
