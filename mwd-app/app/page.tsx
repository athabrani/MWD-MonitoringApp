"use client";

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppProvider, useApp } from '../context/AppContext';
import { Toaster } from 'sonner';
import { DashboardPage } from '../pages/DashboardPage';
import { TrajectoryPage } from '../pages/TrajectoryPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, TrendingUp, LogOut, Menu, Moon, Sun, User, TrendingUp as Logo } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const LoginPage: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password, true);
    if (success) onSuccess();
    else setError('Invalid credentials. Try: operator1, engineer1, or admin1');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
            <Logo className="size-6 text-primary-foreground" />
          </div>
          <CardTitle>MWD Monitor</CardTitle>
          <CardDescription>Real-time Measurement While Drilling</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="operator1" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="any" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, updateSettings } = useApp();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.display.theme === 'dark');
  }, [settings.display.theme]);

  if (!isAuthenticated) return <LoginPage onSuccess={() => setCurrentPage('dashboard')} />;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trajectory', label: 'Trajectory', icon: TrendingUp },
  ];

  const toggleTheme = () => {
    updateSettings({ display: { ...settings.display, theme: settings.display.theme === 'dark' ? 'light' : 'dark' } });
  };

  const NavContent = () => (
    <nav className="space-y-1">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => { setCurrentPage(item.id); setMobileOpen(false); }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            currentPage === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r flex-col p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Logo className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">MWD Monitor</span>
        </div>
        <NavContent />
        <div className="mt-auto space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
            {settings.display.theme === 'dark' ? <Sun className="size-4 mr-2" /> : <Moon className="size-4 mr-2" />}
            {settings.display.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
            <User className="size-4" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}><LogOut className="size-4" /></Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between p-4 border-b">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="size-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Logo className="size-4 text-primary-foreground" />
                </div>
                <span className="font-semibold">MWD Monitor</span>
              </div>
              <NavContent />
            </SheetContent>
          </Sheet>
          <Badge variant="outline">{user?.fullName}</Badge>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'trajectory' && <TrajectoryPage />}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
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
