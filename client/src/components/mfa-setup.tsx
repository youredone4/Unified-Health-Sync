import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check } from "lucide-react";

/** POSTs JSON and returns the parsed body, or throws the server's message. */
export async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data as T;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="rounded-md p-3 text-sm bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
      role="alert"
      data-testid="mfa-error"
    >
      {message}
    </div>
  );
}

/** Shows recovery codes once, and will not let go until the user says they kept them. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the codes are on screen to write down.
    }
  };

  return (
    <div className="space-y-4" data-testid="mfa-recovery-codes">
      <div>
        <p className="font-medium">Save your recovery codes</p>
        <p className="text-sm text-muted-foreground">
          If you lose your phone, one of these codes lets you sign in. Each works once. Write them down or
          print them and keep them somewhere safe, not on this computer. They will not be shown again.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm">
        {codes.map((code) => (
          <span key={code} data-testid="recovery-code">{code}</span>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <><Check className="w-4 h-4 mr-1" />Copied</> : <><Copy className="w-4 h-4 mr-1" />Copy codes</>}
      </Button>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          data-testid="checkbox-codes-saved"
        />
        I have saved these codes somewhere safe.
      </label>
      <Button type="button" className="w-full" disabled={!saved} onClick={onDone} data-testid="button-mfa-done">
        Done
      </Button>
    </div>
  );
}

type Step = "password" | "scan" | "codes";

/**
 * Turns on two-step sign-in for the signed-in account:
 * confirm password -> scan the QR code -> enter a first code -> recovery codes.
 */
export function MfaSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!otpauthUrl) return;
    QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(""));
  }, [otpauthUrl]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const data = await postJson<{ secret: string; otpauthUrl: string }>("/api/auth/mfa/setup", { currentPassword: password });
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setPassword("");
      setStep("scan");
    });
  };

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const data = await postJson<{ recoveryCodes: string[] }>("/api/auth/mfa/enable", { code });
      setCodes(data.recoveryCodes);
      setStep("codes");
    });
  };

  if (step === "codes") return <RecoveryCodes codes={codes} onDone={onDone} />;

  if (step === "scan") {
    return (
      <form onSubmit={confirm} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
          <li>Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).</li>
          <li>In the app, add an account and scan this code.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded bg-white p-2" data-testid="img-mfa-qr" />
          ) : (
            <div className="h-[220px] w-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Can't scan? Enter this key in the app instead:
            <br />
            <span className="font-mono text-foreground select-all" data-testid="text-mfa-secret">
              {secret.replace(/(.{4})/g, "$1 ").trim()}
            </span>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mfa-first-code">6-digit code</Label>
          <Input
            id="mfa-first-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
            data-testid="input-mfa-first-code"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.trim().length < 6} data-testid="button-mfa-enable">
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : "Turn on two-step sign-in"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={start} className="space-y-4">
      {error && <ErrorBox message={error} />}
      <p className="text-sm text-muted-foreground">
        With two-step sign-in, signing in needs your password and a code from an app on your phone. Someone who
        learns your password still cannot get in. First, confirm it is you:
      </p>
      <div className="space-y-2">
        <Label htmlFor="mfa-password">Current password</Label>
        <Input
          id="mfa-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          data-testid="input-mfa-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy || !password} data-testid="button-mfa-start">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : "Continue"}
      </Button>
    </form>
  );
}
