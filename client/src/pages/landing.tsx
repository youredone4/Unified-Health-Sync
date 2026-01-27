import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { ThemeSettings } from "@shared/schema";

interface LastLoginInfo {
  role?: string;
  barangay?: string;
}

export default function LandingPage() {
  const [lastLogin, setLastLogin] = useState<LastLoginInfo>({});

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
            className="w-32 h-32 object-contain"
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

        <Button size="lg" className="w-full" asChild data-testid="button-login">
          <a href="/api/login">Sign In</a>
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          GeoHealthSync - Health Information System
        </p>
      </div>
    </div>
  );
}
