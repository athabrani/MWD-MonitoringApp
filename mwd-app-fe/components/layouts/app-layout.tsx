"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SlidersHorizontal,
  LayoutDashboard,
  LineChart,
  Bell,
  History,
  Download,
  Settings,
  Shield,
  HelpCircle,
  User,
  LogOut,
  Menu,
  Moon,
  Sun,
  Gauge,
  Radar,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";

export type AppPage =
  | "dashboard"
  | "configuration"
  | "configuration-wellplan-surveys"
  | "trajectory"
  | "trajectory-well-plot"
  | "trajectory-analysis"
  | "charts"
  | "alerts"
  | "history"
  | "export"
  | "settings"
  | "admin"
  | "help";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

interface NavigationItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"operator" | "engineer" | "admin">;
}

const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["operator", "engineer", "admin"],
  },
 
  {
    id: "trajectory-analysis",
    label: "Trajectory Analysis",
    icon: Radar,
    roles: ["engineer", "admin", "operator"],
  },
  {
    id: "trajectory-well-plot",
    label: "Well Plots",
    icon: Gauge,
    roles: ["engineer", "admin", "operator"],
  },
  {
    id: "charts",
    label: "Charts",
    icon: LineChart,
    roles: ["engineer", "admin"],
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: Bell,
    roles: ["operator", "engineer", "admin"],
  },
  {
    id: "history",
    label: "History",
    icon: History,
    roles: ["engineer", "admin"],
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    roles: ["engineer", "admin"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    roles: ["operator", "engineer", "admin"],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    roles: ["admin"],
  },
   {
    id: "configuration",
    label: "Configuration",
    icon: SlidersHorizontal,
    roles: ["operator", "engineer", "admin"],
  },
  {
    id: "help",
    label: "Help",
    icon: HelpCircle,
    roles: ["operator", "engineer", "admin"],
  },
];

const pageThemeClasses: Record<AppPage, string> = {
  dashboard: "page-surface page-dashboard",
  configuration: "page-surface page-settings",
  "configuration-wellplan-surveys": "page-surface page-settings",
  trajectory: "page-surface page-trajectory",
  "trajectory-well-plot": "page-surface page-trajectory",
  "trajectory-analysis": "page-surface page-trajectory",
  charts: "page-surface page-charts",
  alerts: "page-surface page-alerts",
  history: "page-surface page-history",
  export: "page-surface page-export",
  settings: "page-surface page-settings",
  admin: "page-surface page-admin",
  help: "page-surface page-help",
};

const softEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

export function getAppPagePath(page: AppPage): string {
  switch (page) {
    case "dashboard":
      return "/";
    case "configuration":
      return "/configuration";
    case "configuration-wellplan-surveys":
      return "/configuration/wellplan-surveys";
    case "trajectory":
    case "trajectory-analysis":
      return "/trajectory";
    case "trajectory-well-plot":
      return "/trajectory/well-plot";
    case "charts":
      return "/charts";
    case "alerts":
      return "/alerts";
    case "history":
      return "/history";
    case "export":
      return "/export";
    case "settings":
      return "/settings";
    case "admin":
      return "/admin";
    case "help":
      return "/help";
    default:
      return "/";
  }
}

function getParentSection(page: AppPage): AppPage {
  if (page === "configuration-wellplan-surveys") {
    return "configuration";
  }
  if (
    page === "trajectory" ||
    page === "trajectory-analysis" ||
    page === "trajectory-well-plot" ||
    page === "charts"
  ) {
    return "trajectory-analysis";
  }
  return page;
}

function getSectionMeta(activeSection: AppPage) {
  switch (activeSection) {
    case "dashboard":
      return {
        title: "Dashboard",
        subtitle: "Operational overview and system summary",
        sections: [
          {
            title: "Overview",
            items: [
              {
                id: "dashboard" as AppPage,
                label: "Main Dashboard",
                description: "General monitoring surface",
                icon: LayoutDashboard,
              },
            ],
          },
          // {
          //   title: "Focus",
          //   items: [
          //     {
          //       id: "alerts" as AppPage,
          //       label: "Active Alerts",
          //       description: "Alarm state and quick response",
          //       icon: Bell,
          //     },
          //     {
          //       id: "charts" as AppPage,
          //       label: "Trend Charts",
          //       description: "Time-series drilling trends",
          //       icon: Activity,
          //     },
          //   ],
          // },
        ],
      };

    case "configuration":
      return {
        title: "Configuration",
        subtitle: "Software setup, surveys, WITS IDs, decoder, and system info",
        sections: [
          {
            title: "Software Setup",
            items: [
              {
                id: "configuration" as AppPage,
                label: "Configuration Workspace",
                description: "Well info, contacts, surveys, WITS IDs, decoder, and SMTP templates",
                icon: SlidersHorizontal,
              },
            ],
          },
          {
            title: "Related",
            items: [
              {
                id: "settings" as AppPage,
                label: "Application Settings",
                description: "Theme, display, and operator preferences",
                icon: Settings,
              },
              {
                id: "export" as AppPage,
                label: "Export Center",
                description: "Output staging for reports and future LAS workflows",
                icon: Download,
              },
            ],
          },
        ],
      };

    case "trajectory":
    case "trajectory-analysis":
      return {
        title: "Trajectory",
        subtitle: "Directional drilling analysis workspace",
        sections: [
          {
            title: "Trajectory Tools",
            items: [
              {
                id: "trajectory-analysis" as AppPage,
                label: "Trajectory Analysis",
                description: "Inspect well direction and path changes",
                icon: Radar,
              },
              {
                id: "trajectory-well-plot" as AppPage,
                label: "Well Plots",
                description: "Depth-based MWD stacked plots",
                icon: Gauge,
              },
              {
                id: "charts" as AppPage,
                label: "Charts",
                description: "Supporting sensor trends",
                icon: LineChart,
              },
            ],
          },
          {
            title: "Related",
            items: [
              {
                id: "history" as AppPage,
                label: "History",
                description: "Past runs and playback context",
                icon: History,
              },
            ],
          },
        ],
      };

    // case "charts":
    //   return {
    //     title: "Charts",
    //     subtitle: "Trend and comparative drilling charts",
    //     sections: [
    //       {
    //         title: "Chart Types",
    //         items: [
    //           {
    //             id: "charts" as AppPage,
    //             label: "Trend Charts",
    //             description: "Sensor and drilling parameter trends",
    //             icon: LineChart,
    //           },
    //           {
    //             id: "trajectory-well-plot" as AppPage,
    //             label: "Well Plot Companion",
    //             description: "Cross-check against depth plots",
    //             icon: FileBarChart,
    //           },
    //         ],
    //       },
    //     ],
    //   };

    case "alerts":
      return {
        title: "Alerts",
        subtitle: "Alarm handling and abnormal event review",
        sections: [
          {
            title: "Monitoring",
            items: [
              {
                id: "alerts" as AppPage,
                label: "Alert Center",
                description: "Current alarms and severity state",
                icon: Bell,
              },
              {
                id: "history" as AppPage,
                label: "Alert History",
                description: "Past alarm timeline and review",
                icon: History,
              },
            ],
          },
        ],
      };

    case "history":
      return {
        title: "History",
        subtitle: "Historical records and event tracing",
        sections: [
          {
            title: "Records",
            items: [
              {
                id: "history" as AppPage,
                label: "Session History",
                description: "Past operations and archived sessions",
                icon: History,
              },
              {
                id: "export" as AppPage,
                label: "Export Data",
                description: "Download reviewed datasets",
                icon: Download,
              },
            ],
          },
        ],
      };

    case "export":
      return {
        title: "Export",
        subtitle: "Download reports and analysis artifacts",
        sections: [
          {
            title: "Output",
            items: [
              {
                id: "export" as AppPage,
                label: "Export Center",
                description: "Create downloadable outputs",
                icon: Download,
              },
              {
                id: "history" as AppPage,
                label: "Source History",
                description: "Select historical dataset source",
                icon: History,
              },
            ],
          },
        ],
      };

    case "settings":
      return {
        title: "Settings",
        subtitle: "Display, preferences, and account setup",
        sections: [
          {
            title: "Preferences",
            items: [
              {
                id: "settings" as AppPage,
                label: "System Settings",
                description: "Theme, behavior, and preferences",
                icon: Settings,
              },
              {
                id: "help" as AppPage,
                label: "Help & Docs",
                description: "Guidance and references",
                icon: HelpCircle,
              },
            ],
          },
        ],
      };

    case "admin":
      return {
        title: "Admin",
        subtitle: "Administration and privileged tools",
        sections: [
          {
            title: "Administration",
            items: [
              {
                id: "admin" as AppPage,
                label: "Admin Panel",
                description: "Restricted administrative actions",
                icon: Shield,
              },
              {
                id: "settings" as AppPage,
                label: "System Settings",
                description: "Shared environment configuration",
                icon: Settings,
              },
            ],
          },
        ],
      };

    case "help":
      return {
        title: "Help",
        subtitle: "Reference and user support",
        sections: [
          {
            title: "Support",
            items: [
              {
                id: "help" as AppPage,
                label: "Help Center",
                description: "Usage guide and operator support",
                icon: HelpCircle,
              },
              {
                id: "settings" as AppPage,
                label: "Preferences",
                description: "Adjust UI and display options",
                icon: Settings,
              },
            ],
          },
        ],
      };

    default:
      return {
        title: "Workspace",
        subtitle: "Navigation",
        sections: [],
      };
  }
}

// function BrandMark() {
//   return (
//     <div className="flex items-center gap-3">
//       <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
//         <Drill className="size-5" />
//       </div>
//       <div className="min-w-0">
//         <div className="truncate text-sm font-semibold text-foreground">
//           MWD Monitor
//         </div>
//         <div className="truncate text-xs text-muted-foreground">
//           Real-time drilling workspace
//         </div>
//       </div>
//     </div>
//   );
// }

function SearchBox({
  collapsed,
  value,
  onChange,
}: {
  collapsed: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "transition-all duration-500",
        collapsed ? "flex" : "w-full"
      )}
      style={{ transitionTimingFunction: softEasing }}
    >
      <div
        className={cn(
          "flex h-10 items-center rounded-xl border bg-background/60 backdrop-blur-sm transition-all duration-500",
          collapsed ? "w-10 justify-center px-0" : "w-full px-3"
        )}
        style={{ transitionTimingFunction: softEasing }}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />

        <div
          className={cn(
            "overflow-hidden transition-all duration-500",
            collapsed ? "ml-0 w-0 opacity-0" : "ml-2 w-full opacity-100"
          )}
          style={{ transitionTimingFunction: softEasing }}
        >
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search menu..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            tabIndex={collapsed ? -1 : 0}
          />
        </div>
      </div>
    </div>
  );
}

function IconRailButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
        active
          ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function IconRail({
  activeSection,
  onChange,
  allowedItems,
  isDark,
}: {
  activeSection: AppPage;
  onChange: (page: AppPage) => void;
  allowedItems: NavigationItem[];
  isDark: boolean;
}) {
  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-5rem)] w-[56px] shrink-0 border-r px-1.5 py-3 backdrop-blur lg:flex lg:flex-col xl:w-[60px] xl:px-2",
        isDark
          ? "border-white/10 bg-[#0f1b2d]"
          : "border-border/70 bg-card/90"
      )}
    >
      <div className="flex flex-col items-center gap-2">
        {allowedItems
          .filter(
            (item) =>
              item.id !== "alerts" &&
              item.id !== "settings" &&
              item.id !== "charts" &&
              item.id !== "trajectory-well-plot"
          )
          .map((item) => (
          <IconRailButton
            key={item.id}
            active={activeSection === getParentSection(item.id)}
            onClick={() => onChange(getParentSection(item.id))}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </div>
    </aside>
  );
}

function DetailNavItem({
  icon: Icon,
  label,
  description,
  active,
  collapsed,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group w-full rounded-xl border text-left transition-all duration-300",
        collapsed
          ? "flex h-11 w-11 items-center justify-center p-0"
          : "flex min-h-[56px] items-start gap-3 px-3 py-3",
        active
          ? "border-primary/30 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-muted/70"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="size-4" />
      </div>

      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {label}
            </span>
            {badge}
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      )}
    </button>
  );
}

function DesktopDetailSidebar({
  currentPage,
  onNavigate,
  activeSection,
  setActiveSection,
  activeAlarms,
  isDark,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeSection: AppPage;
  setActiveSection: (page: AppPage) => void;
  activeAlarms: number;
  isDark: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const meta = getSectionMeta(activeSection);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return meta.sections;
    const q = search.toLowerCase();

    return meta.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [meta.sections, search]);

  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0  lg:flex lg:flex-col",
        isDark ? "border-white/10 bg-[#0f1b2d]" : "border-border/70 bg-card",
        collapsed
          ? "w-[64px] px-1.5 py-4 xl:w-[76px] xl:px-2"
          : "w-[208px] px-2 py-4 xl:w-[228px] xl:px-2.5 2xl:w-[260px]"
      )}
      style={{
        transition: `width 500ms ${softEasing}, padding 500ms ${softEasing}`,
      }}
    >
      {collapsed ? (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <CollapsedActionButton
              icon={PanelLeftOpen}
              label="Expand sidebar"
              onClick={() => setCollapsed(false)}
              isDark={isDark}
            />

            {filteredSections.flatMap((section) =>
              section.items.map((item) => (
                <DetailNavItem
                  key={`${section.title}-${item.id}`}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  active={currentPage === item.id}
                  collapsed
                  onClick={() => {
                    setActiveSection(getParentSection(item.id));
                    onNavigate(item.id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="shrink-0 rounded-xl"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>

          <div className="mt-4">
            <SearchBox collapsed={false} value={search} onChange={setSearch} />
          </div>

          <div className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
            {filteredSections.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </div>

                <div className="space-y-2">
                  {section.items.map((item) => (
                    <DetailNavItem
                      key={`${section.title}-${item.id}`}
                      icon={item.icon}
                      label={item.label}
                      description={item.description}
                      active={currentPage === item.id}
                      collapsed={false}
                      onClick={() => {
                        setActiveSection(getParentSection(item.id));
                        onNavigate(item.id);
                      }}
                      badge={
                        item.id === "alerts" && activeAlarms > 0 ? (
                          <Badge variant="destructive" className="ml-auto">
                            {activeAlarms}
                          </Badge>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "mt-4 border-t pt-4",
              isDark ? "border-white/10" : "border-border/70"
            )}
          >
            <div
              className={cn(
                "rounded-2xl border p-3",
                isDark
                  ? "border-white/10 bg-[#0f1b2d]"
                  : "border-border/70 bg-background/80"
              )}
            >
              <div className="mb-2 text-sm font-medium text-foreground">
                Quick status
              </div>
              <div className="text-xs text-muted-foreground">
                Navigate across monitoring modules from the side panels.
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function CollapsedActionButton({
  icon: Icon,
  label,
  onClick,
  isDark,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "group flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-transparent text-muted-foreground transition-all duration-300 hover:text-foreground",
        isDark ? "hover:border-white/10 hover:bg-white/5" : "hover:border-border hover:bg-muted/70"
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
        <Icon className="size-4" />
      </div>
    </button>
  );
}

function MobileNav({
  items,
  currentPage,
  onNavigate,
  activeAlarms,
}: {
  items: NavigationItem[];
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeAlarms: number;
}) {
  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;

        return (
          <Button
            key={item.id}
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start gap-3 rounded-xl"
            onClick={() => onNavigate(item.id)}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
            {item.id === "alerts" && activeAlarms > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {activeAlarms}
              </Badge>
            )}
          </Button>
        );
      })}
    </nav>
  );
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPage,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { connectionState, reconnect, settings, updateSettings } = useApp();
  const isDark = settings.display.theme === "dark";
  const [mounted, setMounted] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppPage>(
    getParentSection(currentPage)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredNavItems = useMemo(
    () =>
      (mounted ? navigationItems : []).filter(
        (item) => user && item.roles.includes(user.role)
      ),
    [mounted, user]
  );

  const activeAlarms = 3;

  const toggleTheme = () => {
    updateSettings({
      display: {
        ...settings.display,
        theme: settings.display.theme === "dark" ? "light" : "dark",
      },
    });
  };

  const handleNavigate = (page: AppPage) => {
    setActiveSection(getParentSection(page));
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  React.useEffect(() => {
    setActiveSection(getParentSection(currentPage));
  }, [currentPage]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header
        className={cn(
          "sticky top-0 z-50 backdrop-blur",
          isDark
            ? "border-white/10 bg-[#0f1b2d]/95 supports-[backdrop-filter]:bg-[#0f1b2d]/85"
            : "border-border/70 bg-card/90 supports-[backdrop-filter]:bg-card/70"
        )}
      >
        <div className="flex h-20 items-center gap-3 px-4 md:px-6">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[300px] sm:w-[360px]">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
              </SheetHeader>

              <div className="py-4">
            

                <MobileNav
                  items={filteredNavItems}
                  currentPage={currentPage}
                  onNavigate={handleNavigate}
                  activeAlarms={activeAlarms}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-3xl">
                MWD Monitor
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Real-time drilling data
              </p>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden xl:block">
              <ConnectionStatus
                connectionState={connectionState}
                onReconnect={reconnect}
                compact
                showMetricsInCompact
              />
            </div>

            <div className="hidden h-8 w-px bg-border/70 xl:block" />

            <div className="hidden items-center gap-2 xl:flex">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => handleNavigate("alerts")}
                title="Alerts"
              >
                <div className="relative">
                  <Bell className="size-5" />
                  {activeAlarms > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {activeAlarms}
                    </span>
                  ) : null}
                </div>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => handleNavigate("settings")}
                title="Settings"
              >
                <Settings className="size-5" />
              </Button>
            </div>

            <div className="hidden h-8 w-px bg-border/70 xl:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="shrink-0 rounded-full"
                >
                  <User className="size-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <Badge variant="secondary" className="mt-1 text-xs capitalize">
                      {user?.role}
                    </Badge>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={toggleTheme}>
                  {settings.display.theme === "dark" ? (
                    <>
                      <Sun className="mr-2 size-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 size-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleNavigate("settings")}>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={logout} className="text-red-500">
                  <LogOut className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      
        <div className="flex min-h-[calc(100vh-5rem)] min-w-0 items-start">
          <IconRail
            activeSection={activeSection}
            onChange={setActiveSection}
            allowedItems={filteredNavItems}
            isDark={isDark}
          />

          <DesktopDetailSidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            activeAlarms={activeAlarms}
            isDark={isDark}
          />

         <main className="min-w-0 flex-1 p-1.5 md:p-3 xl:p-3">
          <div
            className={cn(
              "min-h-[calc(100vh-5rem)] min-w-0 overflow-hidden rounded-r-3xl border border-l-0 bg-card p-2 shadow-sm transition-colors duration-300 md:p-3 xl:p-3",
              pageThemeClasses[currentPage]
            )}
          >
            {children}
          </div>
        </main>
        </div>
      </div>
  
  );
};
