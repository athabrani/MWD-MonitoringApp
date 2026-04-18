"use client";

import React, { useMemo, useState } from "react";
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
  LayoutDashboard,
  TrendingUp,
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
  ChevronDown,
  Activity,
  Gauge,
  FileBarChart,
  Radar,
  PanelLeftClose,
  PanelLeftOpen,
  Drill,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";

type AppPage =
  | "dashboard"
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

interface NavigationChildItem {
  id: AppPage;
  label: string;
  description?: string;
}

interface NavigationItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"operator" | "engineer" | "admin">;
  children?: NavigationChildItem[];
}

const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["operator", "engineer", "admin"],
  },
  {
    id: "trajectory",
    label: "Trajectory",
    icon: TrendingUp,
    roles: ["engineer", "admin", "operator"],
    children: [
      {
        id: "trajectory-analysis",
        label: "Trajectory Analysis",
        description: "Directional path and deviation review",
      },
      {
        id: "trajectory-well-plot",
        label: "Well Plots",
        description: "Depth-based MWD visualizations",
      },
    ],
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
    id: "help",
    label: "Help",
    icon: HelpCircle,
    roles: ["operator", "engineer", "admin"],
  },
];

const pageThemeClasses: Record<AppPage, string> = {
  dashboard: "page-surface page-dashboard",
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

function isChildPage(page: AppPage) {
  return page === "trajectory-analysis" || page === "trajectory-well-plot";
}

function getParentSection(page: AppPage): AppPage {
  if (isChildPage(page)) return "trajectory";
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
          {
            title: "Focus",
            items: [
              {
                id: "alerts" as AppPage,
                label: "Active Alerts",
                description: "Alarm state and quick response",
                icon: Bell,
              },
              {
                id: "charts" as AppPage,
                label: "Trend Charts",
                description: "Time-series drilling trends",
                icon: Activity,
              },
            ],
          },
        ],
      };

    case "trajectory":
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
            ],
          },
          {
            title: "Related",
            items: [
              {
                id: "charts" as AppPage,
                label: "Charts",
                description: "Supporting sensor trends",
                icon: LineChart,
              },
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

    case "charts":
      return {
        title: "Charts",
        subtitle: "Trend and comparative drilling charts",
        sections: [
          {
            title: "Chart Types",
            items: [
              {
                id: "charts" as AppPage,
                label: "Trend Charts",
                description: "Sensor and drilling parameter trends",
                icon: LineChart,
              },
              {
                id: "trajectory-well-plot" as AppPage,
                label: "Well Plot Companion",
                description: "Cross-check against depth plots",
                icon: FileBarChart,
              },
            ],
          },
        ],
      };

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

function UserAvatar() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <User className="size-4" />
    </div>
  );
}

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
}: {
  activeSection: AppPage;
  onChange: (page: AppPage) => void;
  allowedItems: NavigationItem[];
}) {
  return (
    <aside className="hidden h-[calc(100vh-5rem)] w-[72px] shrink-0 border-r border-white/10 bg-[#0f1b2d] bg-card/80 p-3 backdrop-blur lg:flex lg:flex-col">
      {/* <div className="mb-3 flex justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <TrendingUp className="size-5" />
        </div>
      </div> */}

      <div className="flex flex-col items-center gap-2">
        {allowedItems.map((item) => (
          <IconRailButton
            key={item.id}
            active={activeSection === item.id}
            onClick={() => onChange(item.id)}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <IconRailButton
          active={activeSection === "settings"}
          onClick={() => onChange("settings")}
          icon={Settings}
          label="Settings"
        />
        <UserAvatar />
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

function ExpandableNavGroup({
  icon: Icon,
  label,
  active,
  open,
  collapsed,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  open?: boolean;
  collapsed?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={label}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
          active
            ? "border-primary/30 bg-primary/10"
            : "border-transparent hover:border-border hover:bg-muted/70"
        )}
      >
        <Icon className="size-4" />
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-300",
          active
            ? "border-primary/30 bg-primary/10"
            : "border-transparent hover:border-border hover:bg-muted/70"
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0  rounded-lg",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {label}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-500",
            open ? "rotate-180" : "rotate-0"
          )}
          style={{ transitionTimingFunction: softEasing }}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-500",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        style={{ transitionTimingFunction: softEasing }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "ml-6 mt-2 space-y-2 border-l pl-4 transition-all duration-500",
              open ? "translate-y-0" : "-translate-y-2"
            )}
            style={{ transitionTimingFunction: softEasing }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopDetailSidebar({
  currentPage,
  onNavigate,
  activeSection,
  setActiveSection,
  activeAlarms,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeSection: AppPage;
  setActiveSection: (page: AppPage) => void;
  activeAlarms: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [openTrajectory, setOpenTrajectory] = useState(true);

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
        "hidden h-screen shrink-0 border-r border-white/10 bg-card/80 backdrop-blur lg:flex lg:flex-col",
        collapsed ? "w-[88px] px-4 py-4" : "w-[320px] px-4 py-4"
      )}
      style={{
        transition: `width 500ms ${softEasing}, padding 500ms ${softEasing}`,
      }}
    >
      {!collapsed}
      {/* {!collapsed && <BrandMark />} */}

      <div className={cn("mt-2", collapsed ? "flex justify-center" : "")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-xl"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      <div className="mt-4">
        {!collapsed && (
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
        )}

        <SearchBox collapsed={collapsed} value={search} onChange={setSearch} />
      </div>

      <div className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
        {filteredSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </div>
            )}

            <div className="space-y-2">
              {section.items.map((item) => {
                if (item.id === "trajectory-analysis" || item.id === "trajectory-well-plot") {
                  return (
                    <ExpandableNavGroup
                      key="trajectory-group"
                      icon={TrendingUp}
                      label="Trajectory"
                      active={isChildPage(currentPage) || currentPage === "trajectory"}
                      open={openTrajectory}
                      collapsed={collapsed}
                      onToggle={() => {
                        setOpenTrajectory((v) => !v);
                        setActiveSection("trajectory");
                      }}
                    >
                      <DetailNavItem
                        icon={Radar}
                        label="Trajectory Analysis"
                        description="Directional path and deviation review"
                        active={currentPage === "trajectory-analysis"}
                        onClick={() => onNavigate("trajectory-analysis")}
                      />
                      <DetailNavItem
                        icon={Gauge}
                        label="Well Plots"
                        description="Depth-based stacked measurements"
                        active={currentPage === "trajectory-well-plot"}
                        onClick={() => onNavigate("trajectory-well-plot")}
                      />
                    </ExpandableNavGroup>
                  );
                }

                return (
                  <DetailNavItem
                    key={`${section.title}-${item.id}`}
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                    active={currentPage === item.id}
                    collapsed={collapsed}
                    onClick={() => {
                      setActiveSection(getParentSection(item.id));
                      onNavigate(item.id);
                    }}
                    badge={
                      item.id === "alerts" && activeAlarms > 0 && !collapsed ? (
                        <Badge variant="destructive" className="ml-auto">
                          {activeAlarms}
                        </Badge>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="mt-4 border-t pt-4">
          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="mb-2 text-sm font-medium text-foreground">
              Quick status
            </div>
            <div className="text-xs text-muted-foreground">
              Navigate across monitoring modules from the side panels.
            </div>
          </div>
        </div>
      )}
    </aside>
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
  const [openTrajectory, setOpenTrajectory] = useState(true);

  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentPage === item.id ||
          item.children?.some((child) => child.id === currentPage);

        if (item.children?.length) {
          return (
            <div key={item.id} className="space-y-2">
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 rounded-xl"
                onClick={() => setOpenTrajectory((v) => !v)}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 transition-transform duration-500",
                    openTrajectory ? "rotate-180" : "rotate-0"
                  )}
                />
              </Button>

              <div
                className={cn(
                  "grid transition-all duration-500",
                  openTrajectory
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="ml-5 space-y-2 border-l pl-3">
                    {item.children.map((child) => (
                      <Button
                        key={child.id}
                        variant={currentPage === child.id ? "secondary" : "ghost"}
                        className="w-full justify-start rounded-xl text-sm"
                        onClick={() => onNavigate(child.id)}
                      >
                        {child.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppPage>(
    getParentSection(currentPage)
  );

  const filteredNavItems = useMemo(
    () =>
      navigationItems.filter(
        (item) => user && item.roles.includes(user.role)
      ),
    [user]
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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70">
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
                {/* <div className="mb-6">
                  <BrandMark />
                </div> */}

                <MobileNav
                  items={filteredNavItems}
                  currentPage={currentPage}
                  onNavigate={handleNavigate}
                  activeAlarms={activeAlarms}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <TrendingUp className="size-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">
                MWD Monitor
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Real-time drilling data
              </p>
            </div>
          </div>

          <div className="ml-auto hidden xl:block">
            <ConnectionStatus
              connectionState={connectionState}
              onReconnect={reconnect}
              compact
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="icon" className="rounded-full">
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
      </header>

      
        <div className="flex min-h-screen">
          <IconRail
            activeSection={activeSection}
            onChange={setActiveSection}
            allowedItems={filteredNavItems}
          />

          <DesktopDetailSidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            activeAlarms={activeAlarms}
          />

         <main className="flex-1 p-4 md:p-6">
          <div
            className={cn(
              "min-h-[calc(100vh-5rem)] rounded-r-3xl border border-l-0 bg-card p-4 shadow-sm transition-colors duration-300 md:p-6",
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