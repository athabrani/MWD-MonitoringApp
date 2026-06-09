"use client";

import React from "react";
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
