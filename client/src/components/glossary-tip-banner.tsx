import { useState } from "react";
import { Link } from "wouter";
import { HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "healthsync_glossary_banner_dismissed";

/**
 * One-shot onboarding banner that explains the popup-tip system to new
 * users. Shown on /today (and any other surface that mounts it) until
 * the user dismisses it; the dismissal is stored in localStorage so the
 * banner doesn't reappear on subsequent sessions.
 *
 * Only renders if the user hasn't dismissed it. Free of role checks —
 * every role benefits from knowing the popup-tip is there.
 */
export function GlossaryTipBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; }
    catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-3"
      data-testid="glossary-tip-banner"
    >
      <HelpCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden />
      <p className="text-sm flex-1">
        New here? Tap any <span className="font-mono">?</span> icon next to a medical
        or DOH term to see a plain-language definition. The full list lives at{" "}
        <Link href="/glossary" className="underline font-medium">/glossary</Link>.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 shrink-0"
        onClick={handleDismiss}
        aria-label="Dismiss tip"
        data-testid="glossary-tip-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
