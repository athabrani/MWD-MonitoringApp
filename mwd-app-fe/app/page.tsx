"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { X, Download, RefreshCw } from "lucide-react";

import { AppLayout, AppPage } from "@/components/layouts/app-layout";
import RigWitsPage from "./monitoring/rig-wits/page";
import AuxPortPage from "./monitoring/aux-port/page";
import SurveyDataPage from "./data-management/survey-data/page";
import LogDataPage from "./data-management/log-data/page";
import MemoryImportPage from "./data-management/memory-import/page";
import PlottingPage from "./data-management/plotting/page";
import GenerateLasPage from "./data-management/generate-las/page";

import LoginPage from "./login/page";
import DashboardPage from "./dashboard/page";
import TrajectoryPage from "./trajectory/page";
import ChartsPage from "./charts/page";
import AlertsPage from "./alerts/page";
import HistoryPage from "./history/page";
import ExportPage from "./export/page";
import SettingsPage from "./settings/page";
import AdminPage from "./admin/page";
import HelpPage from "./help/page";
import WellPlotPage from "./trajectory/well-plot/page";
import ConfigurationPage from "./configuration/page";
import WellplanSurveysPage from "./configuration/wellplan-surveys/page";

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    showInstallPrompt,
    dismissInstallPrompt,
    updateAvailable,
    dismissUpdatePrompt,
    settings,
  } = useApp();

  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Apply dark mode
  useEffect(() => {
    if (settings.display.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.display.theme]);

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentPage("dashboard")} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "configuration":
        return <ConfigurationPage onNavigate={setCurrentPage} />;
      case "configuration-wellplan-surveys":
        return <WellplanSurveysPage onNavigate={setCurrentPage} />;
      case "monitoring":
        return <RigWitsPage onNavigate={setCurrentPage} />;
      case "monitoring-rig-wits":
        return <RigWitsPage onNavigate={setCurrentPage} />;
      case "monitoring-aux-port":
        return <AuxPortPage onNavigate={setCurrentPage} />;
      case "data-management":
        return <SurveyDataPage onNavigate={setCurrentPage} />;
      case "data-management-survey-data":
        return <SurveyDataPage onNavigate={setCurrentPage} />;
      case "data-management-log-data":
        return <LogDataPage onNavigate={setCurrentPage} />;
      case "data-management-memory-import":
        return <MemoryImportPage onNavigate={setCurrentPage} />;
      case "data-management-plotting":
        return <PlottingPage onNavigate={setCurrentPage} />;
      case "data-management-generate-las":
        return <GenerateLasPage onNavigate={setCurrentPage} />;
      case "trajectory":
      case "trajectory-well-plot":
        return <WellPlotPage/>;
      case "trajectory-analysis":
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
        return <SettingsPage onNavigate={setCurrentPage} />;
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

    </>
  );
};

export default function App() {
  return <AppContent />;
}
