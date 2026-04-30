import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  testId?: string;
}

/**
 * ErrorState — shown when a query / mutation fails. Makes the failure
 * legible and offers a retry path instead of leaving the user staring at
 * a blank surface.
 */
export function ErrorState({
  title = "Couldn't load data",
  description = "Check your connection and try again. If the problem persists, contact your system admin.",
  onRetry,
  testId = "error-state",
}: ErrorStateProps) {
  return (
    <Card
      className="border-destructive/30 bg-destructive/5"
      role="alert"
      data-testid={testId}
    >
      <CardContent className="py-10 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive" aria-hidden />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        {onRetry ? (
          <div className="pt-1">
            <Button variant="outline" onClick={onRetry} data-testid={`${testId}-retry`}>
              Retry
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
