import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { MfaSetup, RecoveryCodes, postJson } from "@/components/mfa-setup";

interface MfaStatus {
  enabled: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
}

type Mode = "idle" | "setup" | "new-codes" | "disable" | "show-codes";

/** "Two-step sign-in" section of the My Account page. */
export function TwoStepCard() {
  const { data: status, isLoading } = useQuery<MfaStatus>({ queryKey: ["/api/auth/mfa/status"] });
  const [mode, setMode] = useState<Mode>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };
  const reset = () => {
    setMode("idle");
    setPassword("");
    setCode("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "new-codes") {
        const data = await postJson<{ recoveryCodes: string[] }>("/api/auth/mfa/recovery-codes", { currentPassword: password, code });
        setCodes(data.recoveryCodes);
        setPassword("");
        setCode("");
        setMode("show-codes");
      } else if (mode === "disable") {
        await postJson("/api/auth/mfa/disable", { currentPassword: password, code });
        reset();
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="card-two-step">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Two-step sign-in
          {status && (
            <Badge variant={status.enabled ? "default" : "secondary"} data-testid="badge-two-step">
              {status.enabled ? "On" : "Off"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Signing in asks for your password and a code from an authenticator app on your phone.
          {status?.required && " Required for your role."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}

        {status && !status.enabled && mode === "idle" && (
          <Button onClick={() => setMode("setup")} data-testid="button-two-step-turn-on">Turn on two-step sign-in</Button>
        )}

        {mode === "setup" && <MfaSetup onDone={() => { reset(); refresh(); }} />}

        {mode === "show-codes" && <RecoveryCodes codes={codes} onDone={() => { setCodes([]); reset(); }} />}

        {status?.enabled && mode === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground" data-testid="text-recovery-remaining">
              Recovery codes left: <strong>{status.recoveryCodesRemaining}</strong>
              {status.recoveryCodesRemaining <= 3 && " — create a new set soon."}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setMode("new-codes")} data-testid="button-two-step-new-codes">
                Create new recovery codes
              </Button>
              {!status.required && (
                <Button variant="outline" onClick={() => setMode("disable")} data-testid="button-two-step-turn-off">
                  Turn off
                </Button>
              )}
            </div>
          </div>
        )}

        {(mode === "new-codes" || mode === "disable") && (
          <form onSubmit={submit} className="space-y-4 max-w-sm">
            {error && (
              <div className="rounded-md p-3 text-sm bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800" role="alert">
                {error}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {mode === "new-codes"
                ? "Your old recovery codes will stop working."
                : "After this, your password alone will sign you in."}
            </p>
            <div className="space-y-2">
              <Label htmlFor="two-step-password">Current password</Label>
              <Input id="two-step-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="two-step-code">6-digit code from your app</Label>
              <Input id="two-step-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !password || code.trim().length < 6}>
                {busy ? "Checking..." : mode === "new-codes" ? "Create new codes" : "Turn off two-step sign-in"}
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
