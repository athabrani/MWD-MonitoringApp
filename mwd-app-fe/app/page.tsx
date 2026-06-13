"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import SystemUtilitiesPage from "./system-utilities/page";
import AdminPage from "./admin/page";
import HelpPage from "./help/page";
import WellPlotPage from "./trajectory/well-plot/page";
import ConfigurationPage from "./configuration/page";
import WellplanSurveysPage from "./configuration/wellplan-surveys/page";
import {
  canAccessPage,
  getDefaultAccessiblePage,
  getPageAccessLabel,
  readRolePageAccess,
  RolePageAccessMap,
  subscribeRolePageAccess,
} from "@/lib/page-access";

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const {
    showInstallPrompt,
    dismissInstallPrompt,
    updateAvailable,
    dismissUpdatePrompt,
    settings,
  } = useApp();

  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMap>(() => readRolePageAccess());
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

  useEffect(() => subscribeRolePageAccess(() => setRolePageAccess(readRolePageAccess())), []);

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentPage("dashboard")} />;
  }

  const hasPageAccess = canAccessPage(user?.role, currentPage, rolePageAccess);
  const fallbackPage = getDefaultAccessiblePage(user?.role, rolePageAccess) as AppPage;

  const renderAccessDenied = () => (
    <Alert data-testid="access-denied" className="border-amber-500/40 bg-amber-500/10">
      <AlertTitle>Access denied</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          Your role does not currently have access to {getPageAccessLabel(currentPage)}.
          This is a frontend navigation and page guard; backend endpoint permissions still need backend enforcement.
        </p>
        <Button size="sm" onClick={() => setCurrentPage(fallbackPage)}>
          Go to allowed page
        </Button>
      </AlertDescription>
    </Alert>
  );

  const renderPage = () => {
    if (!hasPageAccess) {
      return renderAccessDenied();
    }

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
      case "trajectory-analysis":
        return <TrajectoryPage onNavigate={setCurrentPage} />;
      case "trajectory-well-plot":
        return <WellPlotPage/>;
      case "charts":
        return <ChartsPage />;
      case "alerts":
        return <AlertsPage />;
      case "history":
        return <HistoryPage />;
      case "export":
        return <ExportPage />;
      case "system-utilities":
        return <SystemUtilitiesPage onNavigate={setCurrentPage} />;
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
        <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[360px] md:w-[440px] lg:right-6 lg:w-[460px]">
          <Alert className="rounded-xl border-border/70 bg-card p-3 pr-3 text-card-foreground shadow-lg md:p-4 md:pr-4 lg:rounded-2xl [&>svg+div]:translate-y-0 [&>svg~*]:pl-6 md:[&>svg~*]:pl-8 [&>svg]:left-3 [&>svg]:top-3 md:[&>svg]:left-4 md:[&>svg]:top-4">
            <Download className="size-3.5 sm:size-4 md:size-5" />
            <AlertDescription className="flex items-center justify-between gap-2 text-xs sm:gap-3 sm:text-sm md:gap-4">
              <div className="min-w-0">
                <p className="mb-0.5 font-medium leading-snug md:text-base">Install MWD Monitor</p>
                <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm md:text-[15px]">
                  Install this app for quick access and offline support
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 rounded-lg p-0 md:h-9 md:w-9"
                  onClick={dismissInstallPrompt}
                  aria-label="Dismiss install prompt"
                  title="Dismiss"
                >
                  <X className="size-3.5 md:size-4" />
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs sm:px-3 md:h-9 md:px-4 md:text-sm"
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
