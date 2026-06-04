"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPageAccessKeyForPath } from "@/lib/page-access";

const publicPaths = new Set(["/", "/login"]);

function isProtectedPath(pathname: string | null) {
  if (!pathname || publicPaths.has(pathname)) return false;
  return Boolean(getPageAccessKeyForPath(pathname));
}

export function FrontendSecurityGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const protectedPath = useMemo(() => isProtectedPath(pathname), [pathname]);

  useEffect(() => {
    if (isLoading) return;

    if (pathname === "/login" && isAuthenticated) {
      router.replace("/");
      return;
    }

    if (protectedPath && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, pathname, protectedPath, router]);

  if (isLoading && protectedPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Restoring session...
      </div>
    );
  }

  if (protectedPath && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Sign in required. Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}
