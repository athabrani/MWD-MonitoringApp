"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  canAccessPage,
  getPageAccessKeyForPath,
  getPageAccessLabel,
  readRolePageAccess,
  RolePageAccessMap,
  subscribeRolePageAccess,
} from "@/lib/page-access";

export function RolePageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMap>(() => readRolePageAccess());

  useEffect(() => subscribeRolePageAccess(() => setRolePageAccess(readRolePageAccess())), []);

  const pageKey = !pathname || pathname === "/" || pathname === "/login" ? null : getPageAccessKeyForPath(pathname);

  if (isLoading || !pageKey || canAccessPage(user?.role, pageKey, rolePageAccess)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen min-h-[100dvh] bg-background p-4 text-foreground md:p-8">
        <Card className="mx-auto max-w-2xl p-6">
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription className="mt-2">
              This page requires an authenticated frontend session.
            </AlertDescription>
          </Alert>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-h-[100dvh] bg-background p-4 text-foreground md:p-8">
      <Card className="mx-auto max-w-2xl p-6">
        <Alert data-testid="access-denied" className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription className="mt-2">
            Your role does not currently have access to {getPageAccessLabel(pageKey)}.
            This is a frontend route guard for navigation control; backend endpoint permissions
            should still be enforced by the backend.
          </AlertDescription>
        </Alert>
      </Card>
    </main>
  );
}
