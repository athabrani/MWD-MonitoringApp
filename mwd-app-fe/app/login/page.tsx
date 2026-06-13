"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Lock, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/security/errors";
import { normalizeIdentifierInput } from "@/lib/security/input";

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const normalizedUsername = normalizeIdentifierInput(username);
    setError("");

    if (!normalizedUsername || password.length < 1) {
      setError("Username/email dan password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const success = await login(normalizedUsername, password, rememberMe);
      if (success) {
        toast.success("Berhasil login");
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          router.replace("/");
        }
      } else {
        setError("Invalid username or password.");
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Unable to sign in. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-sm text-slate-400">
        Loading sign-in...
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-grid-slate-800/[0.03] bg-[size:40px_40px]" />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_460px] items-center">
          {/* Left Content */}
          <section className="hidden lg:block">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/20">
              <TrendingUp className="size-7 text-primary-foreground" />
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
                MWD System
              </p>
              <h1 className="max-w-2xl text-4xl xl:text-5xl font-semibold tracking-tight text-white leading-tight">
                Measurement While Drilling Monitoring
              </h1>
              <p className="max-w-xl text-base xl:text-lg leading-7 text-slate-400">
                Secure access to real-time drilling telemetry, trajectory monitoring,
                alarm visibility, and operational measurement data.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  System
                </p>
                <p className="mt-2 text-sm font-medium text-white">Online Monitoring</p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Security
                </p>
                <p className="mt-2 text-sm font-medium text-white">TLS Encrypted</p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Access
                </p>
                <p className="mt-2 text-sm font-medium text-white">Role-Based</p>
              </div>
            </div>
          </section>

          {/* Login Card */}
          <section>
            <Card className="relative overflow-hidden rounded-2xl bg-slate-900/55 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-white/[0.04] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0" />

                <CardContent className="relative p-6 sm:p-8">
                {/* Mobile Header */}
                <div className="mb-8 lg:hidden text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl mb-4 shadow-xl shadow-primary/20">
                    <TrendingUp className="size-8 text-primary-foreground" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
                    MWD Monitor
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-white">
                    Sign in to continue
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                    Access real-time drilling monitoring and operational data.
                    </p>
                </div>

                {/* Desktop Header */}
                <div className="mb-6 hidden lg:block">
                    <h2 className="text-2xl font-semibold text-white">Sign in</h2>
                    <p className="mt-2 text-sm text-slate-400">
                    Enter your account credentials to access.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                    <div
                      data-testid="login-error"
                      className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 backdrop-blur-sm"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                        <p className="text-sm leading-6 text-red-300">{error}</p>
                    </div>
                    )}

                    <div className="space-y-2">
                    <Label htmlFor="username" className="text-slate-200">
                        Username or Email
                    </Label>
                    <Input
                        id="username"
                        data-testid="login-identifier"
                        type="text"
                        placeholder="Enter username or email"
                        value={username}
                        onChange={(e) => setUsername(normalizeIdentifierInput(e.target.value))}
                        required
                        autoComplete="username"
                        className="h-11 border-white/10 bg-black/25 text-slate-100 placeholder:text-slate-400 backdrop-blur-sm focus:border-primary/50 focus:bg-black/35"
                    />
                    </div>

                    <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-200">
                        Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        data-testid="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-11 border-white/10 bg-black/25 pr-11 text-slate-100 placeholder:text-slate-400 backdrop-blur-sm focus:border-primary/50 focus:bg-black/35"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        />
                        <Label
                        htmlFor="remember"
                        className="text-sm cursor-pointer font-normal text-slate-300"
                        >
                        Keep session active
                        </Label>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                        <Lock className="size-3.5" />
                        Secure sign-in
                    </div>
                    </div>

                    <Button
                    type="submit"
                    data-testid="login-submit"
                    className="w-full h-11 text-base"
                    disabled={loading}
                    >
                    {loading ? "Signing in..." : "Sign In"}
                    </Button>
                </form>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4" />
                    Authorized personnel only
                    </div>
                    <div>8h session</div>
                </div>
                </CardContent>
            </Card>
            </section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
