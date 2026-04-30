import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  testId?: string;
}

/**
 * EmptyState — shown when a list / table / page has no data.
 * Standardises the "what now?" UX so every empty list reads the same way:
 * an icon, a one-line title, an optional explainer, and an optional CTA.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="py-12 text-center space-y-3">
        <Icon className="w-12 h-12 mx-auto text-muted-foreground" aria-hidden />
        <p className="text-lg font-semibold">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        ) : null}
        {action ? (
          <div className="pt-2">
            <Button onClick={action.onClick} data-testid={`${testId}-action`}>
              {action.label}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
