"use client";

import React, { useEffect, useState } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { FrontendSecurityGate } from "@/components/frontend-security-gate";
import { RolePageAccessGuard } from "@/components/role-page-access-guard";
import { PWARegister } from "./pwa-register";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Loading application...
      </div>
    );
  }

  return (
    <AuthProvider>
      <FrontendSecurityGate>
        <AppProvider>
          <PWARegister />
          <RolePageAccessGuard>{children}</RolePageAccessGuard>
          <Toaster />
        </AppProvider>
      </FrontendSecurityGate>
    </AuthProvider>
  );
}
