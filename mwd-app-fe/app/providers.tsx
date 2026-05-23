"use client";

import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <AppProvider>
        {children}
        <Toaster />
      </AppProvider>
    </AuthProvider>
  );
}
