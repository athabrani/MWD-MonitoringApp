import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
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
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ConnectionStatus } from './ConnectionStatus';

type AppPage =
  | 'dashboard'
  | 'trajectory'
  | 'charts'
  | 'alerts'
  | 'history'
  | 'export'
  | 'settings'
  | 'admin'
  | 'help';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

interface NavigationItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'operator' | 'engineer' | 'admin'>;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['operator', 'engineer', 'admin'] },
  { id: 'trajectory', label: 'Trajectory', icon: TrendingUp, roles: ['engineer', 'admin'] },
  { id: 'charts', label: 'Charts', icon: LineChart, roles: ['engineer', 'admin'] },
  { id: 'alerts', label: 'Alerts', icon: Bell, roles: ['operator', 'engineer', 'admin'] },
  { id: 'history', label: 'History', icon: History, roles: ['engineer', 'admin'] },
  { id: 'export', label: 'Export', icon: Download, roles: ['engineer', 'admin'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['operator', 'engineer', 'admin'] },
  { id: 'admin', label: 'Admin', icon: Shield, roles: ['admin'] },
  { id: 'help', label: 'Help', icon: HelpCircle, roles: ['operator', 'engineer', 'admin'] }
];

const pageThemeClasses: Record<AppPage, string> = {
  dashboard: 'page-surface page-dashboard',
  trajectory: 'page-surface page-trajectory',
  charts: 'page-surface page-charts',
  alerts: 'page-surface page-alerts',
  history: 'page-surface page-history',
  export: 'page-surface page-export',
  settings: 'page-surface page-settings',
  admin: 'page-surface page-admin',
  help: 'page-surface page-help'
};

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { user, logout } = useAuth();
  const { wells, activeWell, setActiveWell, connectionState, reconnect, settings, updateSettings } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredNavItems = navigationItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const activeAlarms = 3; // Mock count

  const toggleTheme = () => {
    updateSettings({
      display: {
        ...settings.display,
        theme: settings.display.theme === 'dark' ? 'light' : 'dark'
      }
    });
  };

  const NavContent = () => (
    <nav className="space-y-1">
      {filteredNavItems.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        
        return (
          <Button
            key={item.id}
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn(
              "w-full justify-start gap-3",
              isActive && "bg-secondary"
            )}
            onClick={() => {
              onNavigate(item.id);
              setMobileMenuOpen(false);
            }}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
            {item.id === 'alerts' && activeAlarms > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {activeAlarms}
              </Badge>
            )}
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center gap-4 px-4 h-16">
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="py-4">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-1">MWD Monitor</h2>
                  <p className="text-xs text-muted-foreground">Real-time drilling data</p>
                </div>
                <NavContent />
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="size-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold">MWD Monitor</h1>
              <p className="text-xs text-muted-foreground">Real-time Drilling Data</p>
            </div>
          </div>

          {/* Well Selector */}
          <Select
            value={activeWell?.id}
            onValueChange={(wellId) => {
              const well = wells.find(w => w.id === wellId);
              if (well) setActiveWell(well);
            }}
          >
            <SelectTrigger className="w-64 hidden md:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {wells.map(well => (
                <SelectItem key={well.id} value={well.id}>
                  <div>
                    <div className="font-medium">{well.name}</div>
                    <div className="text-xs text-muted-foreground">{well.location}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Connection Status */}
          <div className="ml-auto hidden xl:block">
            <ConnectionStatus 
              connectionState={connectionState} 
              onReconnect={reconnect}
              compact
            />
          </div>

          {/* User Menu */}
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
                {settings.display.theme === 'dark' ? (
                  <>
                    <Sun className="size-4 mr-2" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="size-4 mr-2" />
                    Dark Mode
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate('settings')}>
                <Settings className="size-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-500">
                <LogOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64  bg-card h-[calc(100vh-4rem)] sticky top-16 self-start overflow-y-auto">
          <div className="p-4">
            <NavContent />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div
            className={cn(
              "container max-w-7xl mx-auto p-4 md:p-6 transition-colors duration-300",
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
