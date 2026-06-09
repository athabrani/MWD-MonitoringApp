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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SlidersHorizontal,
  LayoutDashboard,
  LineChart,
  FileDigit,
  SquareActivity,
  FilePen,
  NotebookText,
  FileText,
  Cable,
  Bell,
  History,
  Download,
  Settings,
  Shield,
  HelpCircle,
  User,
  LogOut,
  Moon,
  Sun,
  Gauge,
  Radar,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Wrench,
  RefreshCw,
  Menu,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import {
  canAccessPage,
  getAccessiblePageTarget,
  getNavigationDisplayGroupForPage,
  pageAccessRegistry,
  readRolePageAccess,
  RolePageAccessMap,
  navigationDisplayGroups,
  groupedNavigationUtilityPages,
  subscribeRolePageAccess,
} from "@/lib/page-access";

export type AppPage =
  | "dashboard"
  | "configuration"
  | "configuration-wellplan-surveys"
  | "monitoring"
  | "monitoring-rig-wits"
  | "monitoring-aux-port"
  | "data-management"
  | "data-management-survey-data"
  | "data-management-log-data"
  | "data-management-memory-import"
  | "data-management-plotting"
  | "data-management-generate-las"
  | "trajectory"
  | "trajectory-well-plot"
  | "trajectory-analysis"
  | "charts"
  | "alerts"
  | "history"
  | "export"
  | "system-utilities"
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
}

const navigationItemOrder: AppPage[] = [
  "dashboard",
  "monitoring",
  "data-management",
  "trajectory-analysis",
  "trajectory-well-plot",
  "configuration",
  "system-utilities",
  "charts",
  "alerts",
  "history",
  "export",
  "settings",
  "admin",
  "help",
];

const navigationItemIcons: Record<AppPage, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  configuration: SlidersHorizontal,
  "configuration-wellplan-surveys": NotebookText,
  monitoring: SquareActivity,
  "monitoring-rig-wits": Cable,
  "monitoring-aux-port": Cable,
  "data-management": FileText,
  "data-management-survey-data": FilePen,
  "data-management-log-data": NotebookText,
  "data-management-memory-import": FileDigit,
  "data-management-plotting": FileText,
  "data-management-generate-las": FileDigit,
  trajectory: Radar,
  "trajectory-well-plot": Gauge,
  "trajectory-analysis": Radar,
  charts: LineChart,
  alerts: Bell,
  history: History,
  export: Download,
  "system-utilities": Wrench,
  settings: Settings,
  admin: Shield,
  help: HelpCircle,
};

const navigationItems: NavigationItem[] = navigationItemOrder.map((page) => ({
  id: page,
  label: getRegistryItem(page)?.label ?? page,
  icon: navigationItemIcons[page],
}));

const pageThemeClasses: Record<AppPage, string> = {
  dashboard: "page-surface page-dashboard",
  configuration: "page-surface page-settings",
  "configuration-wellplan-surveys": "page-surface page-settings",
  monitoring: "page-surface page-dashboard",
  "monitoring-rig-wits": "page-surface page-dashboard",
  "monitoring-aux-port": "page-surface page-dashboard",
  "data-management": "page-surface page-history",
  "data-management-survey-data": "page-surface page-history",
  "data-management-log-data": "page-surface page-history",
  "data-management-memory-import": "page-surface page-history",
  "data-management-plotting": "page-surface page-history",
  "data-management-generate-las": "page-surface page-history",
  trajectory: "page-surface page-trajectory",
  "trajectory-well-plot": "page-surface page-trajectory",
  "trajectory-analysis": "page-surface page-trajectory",
  charts: "page-surface page-charts",
  alerts: "page-surface page-alerts",
  history: "page-surface page-history",
  export: "page-surface page-export",
  "system-utilities": "page-surface page-settings",
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
    case "monitoring":
      return "/monitoring/rig-wits";
    case "monitoring-rig-wits":
      return "/monitoring/rig-wits";
    case "monitoring-aux-port":
      return "/monitoring/aux-port";
    case "data-management":
      return "/data-management/survey-data";
    case "data-management-survey-data":
      return "/data-management/survey-data";
    case "data-management-log-data":
      return "/data-management/log-data";
    case "data-management-memory-import":
      return "/data-management/memory-import";
    case "data-management-plotting":
      return "/data-management/plotting";
    case "data-management-generate-las":
      return "/data-management/generate-las";
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
    case "system-utilities":
      return "/system-utilities";
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
  if (page === "monitoring-rig-wits" || page === "monitoring-aux-port") {
    return "monitoring";
  }
  if (
    page === "data-management-survey-data" ||
    page === "data-management-log-data" ||
    page === "data-management-memory-import" ||
    page === "data-management-plotting" ||
    page === "data-management-generate-las"
  ) {
    return "data-management";
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

function getRegistryItem(page: AppPage) {
  return pageAccessRegistry.find((item) => item.key === page);
}

function isPrimaryNavigationItem(item: NavigationItem) {
  return !getRegistryItem(item.id)?.parent;
}

function isCurrentPage(currentPage: AppPage, page: AppPage) {
  if (currentPage === page) return true;
  return currentPage === "trajectory" && page === "trajectory-analysis";
}

function getSecondaryNavLabel(page: AppPage) {
  if (page === "configuration") return "General";

  return getRegistryItem(page)?.label ?? page;
}

function getSecondaryNavigationItems(
  activeSection: AppPage,
  canViewPage: (page: AppPage) => boolean
) {
  const includeParent =
    activeSection === "configuration" || activeSection === "trajectory-analysis";
  const childItems = pageAccessRegistry.filter(
    (item) => item.parent === activeSection && item.key !== "trajectory"
  );
  const sourceItems = [
    ...(includeParent ? [getRegistryItem(activeSection)] : []),
    ...childItems,
  ].filter(Boolean);

  return sourceItems
    .map((item) => ({
      id: item!.key as AppPage,
      label: getSecondaryNavLabel(item!.key as AppPage),
    }))
    .filter((item) => canViewPage(item.id));
}

function getWideNavigationLabel(page: AppPage) {
  switch (page) {
    case "configuration":
      return "General";
    case "trajectory-analysis":
    case "trajectory":
      return "Trajectory Analysis";
    default:
      return getRegistryItem(page)?.label ?? page;
  }
}

function getWideNavigationItemsForGroup(
  groupKey: ReturnType<typeof getNavigationDisplayGroupForPage>,
  currentPage: AppPage,
  canViewPage: (page: AppPage) => boolean
) {
  if (!groupKey) return [];

  const group = navigationDisplayGroups.find((item) => item.key === groupKey);
  if (!group) return [];

  const items = group.pages.filter((page) => canViewPage(page as AppPage)) as AppPage[];
  const currentGroup = getNavigationDisplayGroupForPage(currentPage);
  const shouldAppendCurrentPage =
    currentGroup === groupKey &&
    !groupedNavigationUtilityPages.includes(currentPage) &&
    !items.includes(currentPage) &&
    canViewPage(currentPage);

  if (shouldAppendCurrentPage) {
    items.push(currentPage);
  }

  return items.map((page) => ({
    id: page,
    label: getWideNavigationLabel(page),
  }));
}

function isVerticallyScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const canScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

  return canScroll && element.scrollHeight > element.clientHeight;
}

function getPageScrollContainer(contentElement: HTMLElement | null) {
  if (!contentElement || typeof window === "undefined") return null;

  const explicitContainer = contentElement.querySelector<HTMLElement>("[data-page-scroll-container]");

  if (explicitContainer && isVerticallyScrollable(explicitContainer)) {
    return explicitContainer;
  }

  if (isVerticallyScrollable(contentElement)) {
    return contentElement;
  }

  return null;
}

function getConnectionStatusClasses(status: "connected" | "degraded" | "offline") {
  switch (status) {
    case "connected":
      return "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400";
    case "degraded":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    case "offline":
      return "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "border-border/70 bg-background/80 text-muted-foreground";
  }
}

function TopNavigation({
  items,
  currentPage,
  onNavigate,
  onActiveClick,
  activeAlarms,
  isDark,
}: {
  items: NavigationItem[];
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onActiveClick: () => void;
  activeAlarms: number;
  isDark: boolean;
}) {
  const activeSection = getParentSection(currentPage);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "sticky top-16 z-40 hidden border-b backdrop-blur sm:top-20 xl:block min-[1440px]:hidden",
        isDark
          ? "border-white/10 bg-[#0f1b2d]/95 supports-[backdrop-filter]:bg-[#0f1b2d]/85"
          : "border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/80"
      )}
    >
      <div className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-12 min-w-max items-center gap-1 px-2 py-1.5 sm:min-h-14 sm:px-3 sm:py-2 md:px-6">
          {items.map((item) => {
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (isActive) {
                    onActiveClick();
                    return;
                  }

                  onNavigate(item.id);
                }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-colors sm:h-10 sm:px-3 sm:text-sm md:px-3.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{item.label}</span>
                {item.id === "alerts" && activeAlarms > 0 ? (
                  <Badge
                    variant={isActive ? "secondary" : "destructive"}
                    className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                  >
                    {activeAlarms}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function SecondaryNavigation({
  currentPage,
  activeSection,
  onNavigate,
  onActiveClick,
  canViewPage,
  isDark,
}: {
  currentPage: AppPage;
  activeSection: AppPage;
  onNavigate: (page: AppPage) => void;
  onActiveClick: () => void;
  canViewPage: (page: AppPage) => boolean;
  isDark: boolean;
}) {
  const items = getSecondaryNavigationItems(activeSection, canViewPage);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Section navigation"
      className={cn(
        "hidden border-b xl:block min-[1440px]:hidden",
        isDark ? "border-white/10 bg-[#122037]" : "border-border/70 bg-background/80"
      )}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-2 md:px-6">
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1.5">
            {items.map((item) => {
              const isActive = isCurrentPage(currentPage, item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      onActiveClick();
                      return;
                    }

                    onNavigate(item.id);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                    isActive
                      ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

function WideDesktopNavigation({
  currentPage,
  onNavigate,
  onActiveClick,
  canViewPage,
  isDark,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onActiveClick: () => void;
  canViewPage: (page: AppPage) => boolean;
  isDark: boolean;
}) {
  const activeGroup = getNavigationDisplayGroupForPage(currentPage);
  const visibleGroups = navigationDisplayGroups
    .map((group) => ({
      ...group,
      items: getWideNavigationItemsForGroup(group.key, currentPage, canViewPage),
    }))
    .filter((group) => group.items.length > 0);

  const activeGroupItems =
    visibleGroups.find((group) => group.key === activeGroup)?.items ?? [];

  return (
    <div className="sticky top-20 z-40 hidden min-[1440px]:block">
      <nav
        aria-label="Primary navigation"
        className={cn(
          "border-b backdrop-blur",
          isDark
            ? "border-white/10 bg-[#0f1b2d]/95 supports-[backdrop-filter]:bg-[#0f1b2d]/85"
            : "border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/80"
        )}
      >
        <div className="flex min-w-0 items-center px-6 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {visibleGroups.map((group) => {
              const isActive = activeGroup === group.key;
              const targetPage = group.items[0]?.id;

              if (!targetPage) return null;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      onActiveClick();
                      return;
                    }

                    onNavigate(targetPage);
                  }}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {activeGroupItems.length > 0 ? (
        <nav
          aria-label="Section navigation"
          className={cn(
            "border-b",
            isDark ? "border-white/10 bg-[#122037]" : "border-border/70 bg-background/80"
          )}
        >
          <div className="flex min-w-0 items-center px-6 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {activeGroupItems.map((item) => {
                const isActive = isCurrentPage(currentPage, item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        onActiveClick();
                        return;
                      }

                      onNavigate(item.id);
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function ResponsiveMobileNavigation({
  items,
  currentPage,
  onNavigate,
  onActiveClick,
  canViewPage,
  activeAlarms,
  isDark,
}: {
  items: NavigationItem[];
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onActiveClick: () => void;
  canViewPage: (page: AppPage) => boolean;
  activeAlarms: number;
  isDark: boolean;
}) {
  const activeSection = getParentSection(currentPage);
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([activeSection]);
  const navRef = React.useRef<HTMLElement | null>(null);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const utilityItems = (["alerts", "settings", "help"] as AppPage[])
    .filter((page) => canViewPage(page))
    .map((page) => ({
      id: page,
      label: getRegistryItem(page)?.label ?? page,
    }));
  const utilityActive = utilityItems.some((item) => isCurrentPage(currentPage, item.id));
  const visibleItems = items.filter(
    (item) => !utilityItems.some((utilityItem) => utilityItem.id === item.id)
  );

  useEffect(() => {
    // Keep the active mobile section expanded when navigation changes outside the sheet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenSections((current) =>
      current.includes(activeSection) ? current : [...current, activeSection]
    );
  }, [activeSection]);

  useEffect(() => {
    if (!utilityActive) return;

    // Keep utility pages reachable when a utility route becomes active externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenSections((current) =>
      current.includes("utilities") ? current : [...current, "utilities"]
    );
  }, [utilityActive]);

  useEffect(() => {
    const nav = navRef.current;
    const anchor = anchorRef.current;
    if (!nav || !anchor) return;

    let frame = 0;

    const updatePinnedState = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextHeight = nav.getBoundingClientRect().height;
        const anchorTop = anchor.getBoundingClientRect().top;

        setNavHeight(nextHeight);
        setIsPinned(anchorTop <= 0);
      });
    };

    updatePinnedState();
    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", updatePinnedState);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", updatePinnedState);
    };
  }, []);

  const handleItemNavigate = (page: AppPage) => {
    if (isCurrentPage(currentPage, page)) {
      onActiveClick();
    } else {
      onNavigate(page);
    }

    setOpen(false);
  };

  return (
    <>
    <div ref={anchorRef} className="xl:hidden" aria-hidden="true" />
    {isPinned ? <div className="xl:hidden" style={{ height: navHeight }} aria-hidden="true" /> : null}
    <nav
      ref={navRef}
      aria-label="Mobile primary navigation"
      className={cn(
        "z-40 shrink-0 border-b shadow-sm backdrop-blur xl:hidden",
        isPinned && "fixed inset-x-0 top-0",
        isDark
          ? "border-white/10 bg-[#0f1b2d]/95 supports-[backdrop-filter]:bg-[#0f1b2d]/85"
          : "border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/80"
      )}
    >
      <div className="flex min-h-11 items-center gap-2.5 px-3 py-1.5 sm:min-h-12 sm:gap-3 sm:px-4 sm:py-2 md:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "relative h-9 w-9 shrink-0 rounded-xl border",
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-border/60 bg-background/70 hover:bg-muted"
              )}
            >
              <Menu className="size-4" />
              {activeAlarms > 0 ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[9px] leading-none shadow-sm"
                >
                  {activeAlarms}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className={cn(
              "flex w-[min(88vw,320px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
              isDark ? "bg-[#0f1b2d]" : "bg-background"
            )}
          >
            <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="text-base">Navigation</SheetTitle>
                  <SheetDescription className="mt-1 text-xs">
                    Browse modules and section pages.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 px-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Main menu
                </div>
                <Accordion
                  type="multiple"
                  value={openSections}
                  onValueChange={setOpenSections}
                  className="space-y-1.5"
                >
                  {visibleItems.map((item) => {
                    const sectionItems = getSecondaryNavigationItems(item.id, canViewPage);
                    const hasChildren = sectionItems.length > 0;
                    const isSectionActive = activeSection === item.id;
                    const isSingleActive = isCurrentPage(currentPage, item.id);

                    if (!hasChildren) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemNavigate(item.id)}
                          aria-current={isSingleActive ? "page" : undefined}
                          className={cn(
                            "group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                            isSingleActive
                              ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                              : "text-foreground hover:bg-muted/70"
                          )}
                        >
                          <span className="min-w-0 break-words">{item.label}</span>
                          {item.id === "alerts" && activeAlarms > 0 ? (
                            <Badge
                              variant="destructive"
                              className="h-5 shrink-0 rounded-full px-1.5 text-[10px]"
                            >
                              {activeAlarms}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    }

                    return (
                      <AccordionItem
                        key={item.id}
                        value={item.id}
                        className={cn(
                          "overflow-hidden rounded-xl border px-0 transition-colors",
                          isSectionActive
                            ? "border-primary/30 bg-primary/5 shadow-sm"
                            : "border-transparent bg-transparent hover:border-border/70 hover:bg-muted/30"
                        )}
                      >
                        <AccordionTrigger
                          className={cn(
                            "min-h-11 gap-3 px-3 py-2.5 text-left text-sm font-semibold hover:no-underline [&>svg]:size-4",
                            isSectionActive ? "text-primary" : "text-foreground"
                          )}
                        >
                          <span className="min-w-0 flex-1 break-words">{item.label}</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">
                          <div
                            className={cn(
                              "ml-4 space-y-1 border-l py-1 pl-2",
                              isSectionActive ? "border-primary/25" : "border-border/70"
                            )}
                          >
                            {sectionItems.map((child) => {
                              const isChildActive = isCurrentPage(currentPage, child.id);

                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleItemNavigate(child.id)}
                                  aria-current={isChildActive ? "page" : undefined}
                                  className={cn(
                                    "flex min-h-9 w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                                    isChildActive
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                  )}
                                >
                                  <span className="min-w-0 break-words">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  {utilityItems.length > 0 ? (
                    <AccordionItem
                      value="utilities"
                      className={cn(
                        "overflow-hidden rounded-xl border px-0 transition-colors",
                        utilityActive
                          ? "border-primary/30 bg-primary/5 shadow-sm"
                          : "border-transparent bg-transparent hover:border-border/70 hover:bg-muted/30"
                      )}
                    >
                      <AccordionTrigger
                        className={cn(
                          "min-h-11 gap-3 px-3 py-2.5 text-left text-sm font-semibold hover:no-underline [&>svg]:size-4",
                          utilityActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words">Utilities</span>
                        {activeAlarms > 0 ? (
                          <Badge
                            variant="destructive"
                            className="mr-2 h-5 shrink-0 rounded-full px-1.5 text-[10px]"
                          >
                            {activeAlarms}
                          </Badge>
                        ) : null}
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-2">
                        <div
                          className={cn(
                            "ml-4 space-y-1 border-l py-1 pl-2",
                            utilityActive ? "border-primary/25" : "border-border/70"
                          )}
                        >
                          {utilityItems.map((child) => {
                            const isChildActive = isCurrentPage(currentPage, child.id);

                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleItemNavigate(child.id)}
                                aria-current={isChildActive ? "page" : undefined}
                                className={cn(
                                  "flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                                  isChildActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                )}
                              >
                                <span className="min-w-0 break-words">{child.label}</span>
                                {child.id === "alerts" && activeAlarms > 0 ? (
                                  <Badge
                                    variant="destructive"
                                    className="h-5 shrink-0 rounded-full px-1.5 text-[10px]"
                                  >
                                    {activeAlarms}
                                  </Badge>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ) : null}
                </Accordion>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <button
          type="button"
          onClick={onActiveClick}
          className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left leading-tight transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Scroll current page to top"
          title="Scroll to top"
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Navigation
          </div>
          <div className="truncate text-sm font-semibold">
            {getRegistryItem(currentPage)?.label ?? getRegistryItem(activeSection)?.label ?? "Current page"}
          </div>
        </button>
      </div>
    </nav>
    </>
  );
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

    case "monitoring":
      return {
        title: "Monitoring",
        subtitle: "Rig WITS and AUX runtime traffic diagnostics",
        sections: [
          {
            title: "Monitoring Views",
            items: [
              {
                id: "monitoring-rig-wits" as AppPage,
                label: "Rig WITS",
                description: "Incoming and outgoing rig packet traffic",
                icon: FileDigit,
              },
              {
                id: "monitoring-aux-port" as AppPage,
                label: "Aux Port",
                description: "Decoded AUX packet monitoring",
                icon: Cable,
              },
            ],
          },
        ],
      };

    case "data-management":
      return {
        title: "Data Management",
        subtitle: "Survey workflow and stored WITS data editing",
        sections: [
          {
            title: "Data Workflows",
            items: [
              {
                id: "data-management-survey-data" as AppPage,
                label: "Survey Data",
                description: "Survey input, projection, plotting, and storage config",
                icon: FilePen,
              },
              {
                id: "data-management-log-data" as AppPage,
                label: "Log Data",
                description: "Stored WITS data editor and batch tools",
                icon: NotebookText,
              },
              {
                id: "data-management-plotting" as AppPage,
                label: "Plotting",
                description: "Header, track, PDF, label, and output plot configuration",
                icon: LineChart,
              },
              {
                id: "data-management-generate-las" as AppPage,
                label: "Generate LAS",
                description: "LAS presets, depth export rules, and WITS column selection",
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

    case "system-utilities":
      return {
        title: "System Utilities",
        subtitle: "Database backup, diagnostics, and clear-data tools",
        sections: [
          {
            title: "Utilities",
            items: [
              {
                id: "system-utilities" as AppPage,
                label: "System Utilities",
                description: "Database, system info, and clear-data workflows",
                icon: Wrench,
              },
              {
                id: "settings" as AppPage,
                label: "Application Settings",
                description: "Theme, display, and operator preferences",
                icon: Settings,
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

export function IconRail({
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
        "sticky top-20 hidden h-[calc(100dvh-5rem)] w-[56px] shrink-0 border-r px-1.5 py-3 backdrop-blur lg:flex lg:flex-col xl:w-[60px] xl:px-2",
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
        "group w-full max-w-full min-w-0 rounded-xl border text-left transition-all duration-300",
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
        <div className="min-w-0 flex-1 overflow-visible">
          <div className="flex w-full min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 whitespace-normal break-words text-sm font-medium leading-snug text-foreground">
              {label}
            </span>
            {badge}
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 min-w-0 break-words text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      )}
    </button>
  );
}

export function DesktopDetailSidebar({
  currentPage,
  onNavigate,
  activeSection,
  setActiveSection,
  activeAlarms,
  isDark,
  canViewPage,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeSection: AppPage;
  setActiveSection: (page: AppPage) => void;
  activeAlarms: number;
  isDark: boolean;
  canViewPage: (page: AppPage) => boolean;
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
            canViewPage(item.id) &&
            (item.label.toLowerCase().includes(q) ||
              item.description?.toLowerCase().includes(q))
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [canViewPage, meta.sections, search]);
  const visibleSections = useMemo(
    () =>
      filteredSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => canViewPage(item.id)),
        }))
        .filter((section) => section.items.length > 0),
    [canViewPage, filteredSections]
  );
  const sidebarScrollbarClassName = cn(
    "w-2 border-l-0 bg-transparent p-0.5 transition-colors",
    isDark ? "hover:bg-white/[0.04]" : "hover:bg-muted/60"
  );
  const sidebarThumbClassName = cn(
    "rounded-full transition-colors",
    isDark ? "bg-white/15 hover:bg-white/25" : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
  );

  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100dvh-5rem)] shrink-0  lg:flex lg:flex-col",
        isDark ? "border-white/10 bg-[#0f1b2d]" : "border-border/70 bg-card",
        collapsed
          ? "w-[60px] px-1.5 py-4 xl:w-[60px] xl:px-2"
          : "w-[208px] px-2 py-4 xl:w-[218px] xl:px-2.5 2xl:w-[230px]"
      )}
      style={{
        transition: `width 500ms ${softEasing}, padding 500ms ${softEasing}`,
      }}
    >
      {collapsed ? (
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="h-full"
          scrollbarClassName={sidebarScrollbarClassName}
          thumbClassName={sidebarThumbClassName}
        >
          <div className="flex flex-col items-center gap-2 pb-1">
            <CollapsedActionButton
              icon={PanelLeftOpen}
              label="Expand sidebar"
              onClick={() => setCollapsed(false)}
              isDark={isDark}
            />

            {visibleSections.flatMap((section) =>
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
        </ScrollArea>
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

          <ScrollArea
            className="mt-4 min-h-0 flex-1"
            viewportClassName="min-w-0"
            scrollbarClassName={sidebarScrollbarClassName}
            thumbClassName={sidebarThumbClassName}
          >
            <div className="min-w-0 space-y-5 pb-1 pr-2">
              {visibleSections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </div>

                  <div className="min-w-0 space-y-2">
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
          </ScrollArea>

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

export function MobileNav({
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
  const {
    connectionState,
    networkStatus,
    backendRestStatus,
    backendRestError,
    lastRecoveryAt,
    settings,
    updateSettings,
    activeMwdSession,
    mwdSessions,
    mwdSessionsLoading,
    mwdSessionsError,
    refreshMwdSessions,
    events,
  } = useApp();
  const isDark = settings.display.theme === "dark";
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMap>(() => readRolePageAccess());

  const [activeSection, setActiveSection] = useState<AppPage>(
    getParentSection(currentPage)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1440px)");
    const syncWideDesktop = (event?: MediaQueryListEvent) => {
      setIsWideDesktop(event ? event.matches : mediaQuery.matches);
    };

    syncWideDesktop();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncWideDesktop);
      return () => mediaQuery.removeEventListener("change", syncWideDesktop);
    }

    mediaQuery.addListener(syncWideDesktop);
    return () => mediaQuery.removeListener(syncWideDesktop);
  }, []);

  useEffect(() => subscribeRolePageAccess(() => setRolePageAccess(readRolePageAccess())), []);

  const canViewPage = React.useCallback(
    (page: AppPage) => canAccessPage(user?.role, page, rolePageAccess),
    [rolePageAccess, user?.role]
  );

  const filteredNavItems = useMemo(
    () =>
      (mounted ? navigationItems : []).filter(
        (item) => isPrimaryNavigationItem(item) && user && canViewPage(item.id)
      ),
    [canViewPage, mounted, user]
  );

  const activeAlarms = useMemo(
    () =>
      events.filter(
        (event) => event.type === "alarm" && !event.acknowledgedBy && !event.resolved
      ).length,
    [events]
  );
  const activeSessionLabel = mwdSessionsLoading
    ? "Loading session..."
    : mwdSessionsError
      ? "Session unavailable"
      : activeMwdSession?.name ||
        activeMwdSession?.sessionCode ||
        activeMwdSession?.wellName ||
        "No active session";
  const activeSessionDetail = activeMwdSession
    ? [activeMwdSession.wellName, activeMwdSession.rigName].filter(Boolean).join(" / ") || activeMwdSession.id
    : mwdSessionsError
      ? mwdSessionsError
      : mwdSessionsLoading
        ? "Loading current session context"
        : mwdSessions.length === 0
          ? "Belum ada job/session yang tersedia untuk akun ini"
          : "Current session context";
  const mobileConnectionLabel = connectionState.reconnecting
    ? "Reconnecting"
    : connectionState.status;
  const globalConnectionNotice = useMemo(() => {
    if (networkStatus === "offline") {
      return {
        tone: "destructive",
        title: "Anda sedang offline.",
        description: "Data realtime terputus. Data yang terlihat adalah data terakhir dan mungkin stale.",
      };
    }

    if (backendRestStatus === "auth-error") {
      return {
        tone: "destructive",
        title: "Backend membutuhkan autentikasi ulang.",
        description: backendRestError || "Silakan login ulang sebelum melanjutkan monitoring.",
      };
    }

    if (backendRestStatus === "offline" || backendRestStatus === "error") {
      return {
        tone: "destructive",
        title: "Backend API tidak tersedia.",
        description: backendRestError || "REST refresh gagal. Tidak ada fallback ke data mock.",
      };
    }

    return null;
  }, [
    backendRestError,
    backendRestStatus,
    networkStatus,
  ]);
  const lastRecoveryLabel = lastRecoveryAt
    ? `Recovery terakhir: ${lastRecoveryAt.toLocaleTimeString()}`
    : null;

  const toggleTheme = () => {
    updateSettings({
      display: {
        ...settings.display,
        theme: settings.display.theme === "dark" ? "light" : "dark",
      },
    });
  };

  const scrollActivePageToTop = () => {
    const scrollContainer = getPageScrollContainer(contentRef.current);

    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigate = (page: AppPage) => {
    const targetPage = getAccessiblePageTarget(
      user?.role,
      page,
      "dashboard",
      rolePageAccess
    ) as AppPage;

    if (isCurrentPage(currentPage, targetPage)) {
      scrollActivePageToTop();
      return;
    }

    setActiveSection(getParentSection(targetPage));
    onNavigate(targetPage);
  };

  React.useEffect(() => {
    setActiveSection(getParentSection(currentPage));
  }, [currentPage]);

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
      <header
        className={cn(
          "z-50 backdrop-blur xl:sticky xl:top-0",
          isDark
            ? "border-white/10 bg-[#0f1b2d]/95 supports-[backdrop-filter]:bg-[#0f1b2d]/85"
            : "border-border/70 bg-card/90 supports-[backdrop-filter]:bg-card/70"
        )}
      >
        <div className="flex min-h-14 items-center gap-2 px-3 py-1.5 sm:min-h-20 sm:gap-3 sm:px-4 sm:py-2 md:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <div className="min-w-0 shrink-0">
              <h1 className="truncate text-lg font-semibold sm:text-3xl">
                MWD Monitor
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground min-[420px]:block">
                Real-time drilling data
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 lg:hidden">
                <div className="min-w-0 max-w-[190px] rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] leading-5 text-muted-foreground min-[420px]:max-w-[260px] sm:max-w-[340px] sm:text-xs">
                  <span className="font-medium text-foreground">Session:</span>{" "}
                  <span className="inline-block max-w-[118px] truncate align-bottom min-[420px]:max-w-[188px] sm:max-w-[260px]">
                    {activeSessionLabel}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 gap-1 rounded-full px-2 text-[10px] capitalize sm:text-xs",
                    getConnectionStatusClasses(connectionState.status)
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {mobileConnectionLabel}
                </Badge>
              </div>
            </div>
            <div className="hidden min-w-0 rounded-xl border border-border/70 bg-background/70 px-3 py-2 md:max-w-[360px] xl:block">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Current session
              </div>
              <div className="truncate text-sm font-semibold">{activeSessionLabel}</div>
              <div className="truncate text-xs text-muted-foreground">{activeSessionDetail}</div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden lg:block">
              <ConnectionStatus
                connectionState={connectionState}
                compact
                showMetricsInCompact
                showReconnectAction={false}
              />
            </div>

            <div className="hidden h-8 w-px bg-border/70 xl:block" />

            <div className="hidden items-center gap-2 xl:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => void refreshMwdSessions()}
                disabled={mwdSessionsLoading}
                title="Refresh current session"
              >
                <RefreshCw className={cn("size-5", mwdSessionsLoading && "animate-spin")} />
              </Button>

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

              <DropdownMenuContent align="end" className="w-56 border-border/70">
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

      <ResponsiveMobileNavigation
        items={filteredNavItems}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onActiveClick={scrollActivePageToTop}
        canViewPage={canViewPage}
        activeAlarms={activeAlarms}
        isDark={isDark}
      />

      {mounted && isWideDesktop ? (
        <WideDesktopNavigation
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onActiveClick={scrollActivePageToTop}
          canViewPage={canViewPage}
          isDark={isDark}
        />
      ) : (
        <>
          <TopNavigation
            items={filteredNavItems}
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onActiveClick={scrollActivePageToTop}
            activeAlarms={activeAlarms}
            isDark={isDark}
          />

          <SecondaryNavigation
            currentPage={currentPage}
            activeSection={activeSection}
            onNavigate={handleNavigate}
            onActiveClick={scrollActivePageToTop}
            canViewPage={canViewPage}
            isDark={isDark}
          />
        </>
      )}

      {globalConnectionNotice ? (
        <div
          className={cn(
            "border-b px-3 py-2 text-sm",
            globalConnectionNotice.tone === "destructive"
              ? "border-red-500/30 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/45 dark:text-red-100"
              : "border-amber-500/30 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-100"
          )}
        >
          <div className="mx-auto flex max-w-screen-2xl items-start gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">{globalConnectionNotice.title}</div>
                <div className="text-xs opacity-85">
                  {globalConnectionNotice.description}
                  {lastRecoveryLabel ? ` ${lastRecoveryLabel}.` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-[calc(100dvh-7.5rem)] min-w-0 sm:min-h-[calc(100dvh-8.5rem)]">
        <main className="min-w-0 flex-1 px-1.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1.5 sm:px-2 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pt-2 md:px-3 md:pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pt-3 xl:p-3">
          <div
            ref={contentRef}
            className={cn(
              "min-h-[calc(100dvh-7.5rem)] min-w-0 overflow-visible rounded-2xl border bg-card px-1.5 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-1.5 shadow-sm transition-colors duration-300 sm:min-h-[calc(100dvh-8.5rem)] sm:px-2 sm:pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:pt-2 md:px-3 md:pb-[calc(env(safe-area-inset-bottom)+2rem)] md:pt-3 xl:p-3",
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
