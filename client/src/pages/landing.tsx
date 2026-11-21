import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { getDefaultLandingForRole } from "@/lib/role-landing";

interface LastLoginInfo {
  role?: string;
  barangay?: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

type LoginErrorType = "error" | "locked" | "disabled";

// Accounts are created by a System Administrator; there is no public
// sign-up. This page is the sign-in form only.
export default function LandingPage() {
  const [lastLogin, setLastLogin] = useState<LastLoginInfo>({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<{ type: LoginErrorType; message: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("lastLoginInfo");
    if (stored) {
      try {
        setLastLogin(JSON.parse(stored));
      } catch {
        setLastLogin({});
      }
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.message || "Login failed") as Error & { statusCode?: string; httpStatus?: number };
        err.statusCode = data.statusCode;
        err.httpStatus = response.status;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      setLoginError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Redirect to the role's default landing (see lib/role-landing.ts).
      // window.location.href forces a full reload so the session cookie and
      // auth context reinitialise. An account that must change its password
      // is intercepted by App.tsx before any page renders.
      window.location.href = getDefaultLandingForRole(data?.role);
    },
    onError: (error: Error & { statusCode?: string; httpStatus?: number }) => {
      // The server only sends a specific reason when it is safe to reveal
      // one (the password was right, or the limit was hit). Everything else
      // gets the same generic message.
      if (error.statusCode === "LOCKED" || error.httpStatus === 429) {
        setLoginError({ type: "locked", message: error.message });
      } else if (error.statusCode) {
        setLoginError({ type: "disabled", message: error.message });
      } else {
        setLoginError({ type: "error", message: "Invalid username or password. Please check your credentials." });
      }
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError({ type: "error", message: "Please enter your username and password." });
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  const isTeamLeader = lastLogin.role === "TL";
  const barangayName = lastLogin.barangay;
  // Login page is the app's product surface, not an LGU surface — show
  // the HealthSync brand instead of the municipality settings. The DB
  // settings (lguName / lguSubtitle / logoUrl) still drive every other
  // page in the app.
  const logoUrl = "/healthsync-logo.png";
  const lguName = "HealthSync";
  const lguSubtitle = "Unified Digital Health Information System";

  const errorStyles: Record<LoginErrorType, string> = {
    error: "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
    locked: "bg-yellow-50 text-yellow-900 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
    disabled: "bg-orange-50 text-orange-900 border border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <img src={logoUrl} alt={lguName} className="w-32 h-32 object-contain" data-testid="img-logo" />

        <div className="text-center">
          <h1 className="text-2xl font-bold" data-testid="text-lgu-name">
            {isTeamLeader && barangayName ? `Barangay ${barangayName}` : lguName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">
            {isTeamLeader && barangayName ? lguName : lguSubtitle}
          </p>
        </div>

        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div
                  className={`rounded-md p-3 text-sm ${errorStyles[loginError.type]}`}
                  data-testid="login-error-message"
                  role="alert"
                >
                  {loginError.message}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLoginError(null); }}
                  disabled={loginMutation.isPending}
                  data-testid="input-username"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                    disabled={loginMutation.isPending}
                    data-testid="input-password"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : "Sign In"}
              </Button>
            </form>
            <p className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
              Need an account or forgot your password? Ask your System Administrator.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          HealthSync - Unified Digital Health Information System
        </p>
      </div>
    </div>
  );
}
