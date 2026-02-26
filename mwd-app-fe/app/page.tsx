"use client";

import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AppProvider, useApp } from "../context/AppContext";

import { Toaster } from "@/components/ui/sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { X, Download, RefreshCw } from "lucide-react";

import { AppLayout } from "../components/AppLayout";

import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { TrajectoryPage } from "../pages/TrajectoryPage";
import { ChartsPage } from "../pages/ChartsPage";
import { AlertsPage } from "../pages/AlertsPage";
import { HistoryPage } from "../pages/HistoryPage";
import { ExportPage } from "../pages/ExportPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AdminPage } from "../pages/AdminPage";
import { HelpPage } from "../pages/HelpPage";

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    showInstallPrompt,
    dismissInstallPrompt,
    updateAvailable,
    dismissUpdatePrompt,
    settings,
  } = useApp();

  const [currentPage, setCurrentPage] = useState<
    | "dashboard"
    | "trajectory"
    | "charts"
    | "alerts"
    | "history"
    | "export"
    | "settings"
    | "admin"
    | "help"
  >("dashboard");

  // Apply dark mode
  useEffect(() => {
    if (settings.display.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.display.theme]);

  // Redirect landing page based on role
  useEffect(() => {
    if (!user) return;

    switch (user.role) {
      case "operator":
      case "engineer":
        setCurrentPage("dashboard");
        break;
      case "admin":
        setCurrentPage("admin");
        break;
      default:
        setCurrentPage("dashboard");
        break;
    }
  }, [user]);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentPage("dashboard")} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "trajectory":
        return <TrajectoryPage />;
      case "charts":
        return <ChartsPage />;
      case "alerts":
        return <AlertsPage />;
      case "history":
        return <HistoryPage />;
      case "export":
        return <ExportPage />;
      case "settings":
        return <SettingsPage />;
      case "admin":
        return <AdminPage />;
      case "help":
        return <HelpPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <>
      <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </AppLayout>

      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Alert className="shadow-lg">
            <Download className="size-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium mb-1">Install MWD Monitor</p>
                <p className="text-sm text-muted-foreground">
                  Install this app for quick access and offline support
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={dismissInstallPrompt}>
                  <X className="size-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // NOTE: Di PWA asli, ini biasanya memanggil event "beforeinstallprompt".
                    // Di sini kita samakan dengan contoh kamu: dismiss aja.
                    dismissInstallPrompt();
                  }}
                >
                  Install
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Update Available Prompt */}
      {updateAvailable && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <Alert className="shadow-lg border-primary">
            <RefreshCw className="size-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium mb-1">Update Available</p>
                <p className="text-sm text-muted-foreground">
                  A new version is available. Refresh to update.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={dismissUpdatePrompt}>
                  Later
                </Button>
                <Button size="sm" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Toaster position="top-right" />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}