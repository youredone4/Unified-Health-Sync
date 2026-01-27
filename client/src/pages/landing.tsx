import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ThemeSettings } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface LastLoginInfo {
  role?: string;
  barangay?: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

export default function LandingPage() {
  const [lastLogin, setLastLogin] = useState<LastLoginInfo>({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const { data: settings } = useQuery<ThemeSettings>({
    queryKey: ["/api/theme-settings"],
  });

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
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  const isTeamLeader = lastLogin.role === "TL";
  const barangayName = lastLogin.barangay;
  
  const logoUrl = settings?.logoUrl;
  const lguName = settings?.lguName || "GeoHealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={lguName}
            className="w-24 h-24 object-contain"
            data-testid="img-logo"
          />
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold" data-testid="text-lgu-name">
            {isTeamLeader && barangayName ? `Barangay ${barangayName}` : lguName}
          </h1>
          {isTeamLeader && barangayName ? (
            <p className="text-muted-foreground" data-testid="text-subtitle">
              {lguName}
            </p>
          ) : (
            <p className="text-muted-foreground" data-testid="text-subtitle">
              {lguSubtitle}
            </p>
          )}
        </div>

        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                  data-testid="input-username"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  data-testid="input-password"
                  autoComplete="current-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          HealthSync - Unified Digital Health Information System
        </p>
      </div>
    </div>
  );
}
