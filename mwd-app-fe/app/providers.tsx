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
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "border border-border bg-background text-foreground shadow-lg",
              success: "!border-emerald-200 !bg-emerald-50 !text-emerald-950 dark:!border-emerald-900/60 dark:!bg-emerald-950 dark:!text-emerald-50",
              description: "text-muted-foreground",
            },
          }}
        />
      </AppProvider>
    </AuthProvider>
  );
}
