import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth, permissions } from "@/hooks/use-auth";
import type { ReactNode } from "react";

/**
 * A tab exposed by a program hub header. `roles` is optional — when set, the
 * tab hides for users whose role isn't in the list. Hub pages' route-level
 * RBAC (via RoleRoute) still applies independently; `roles` here is purely
 * cosmetic (don't advertise what the user can't open anyway).
 */
export interface HubTab {
  label: string;
  path: string;
  testId?: string;
  roles?: readonly string[];
}

export interface HubPrimaryAction {
  label: string;
  path: string;
  icon?: React.ElementType;
}

interface ProgramHubProps {
  title: string;
  icon: React.ElementType;
  subtitle?: string;
  primaryAction?: HubPrimaryAction;
  tabs: HubTab[];
  children: ReactNode;
}

/**
 * Shared shell for program-hub pages (Mothers, Children, Seniors, etc.). Every
 * hub renders the same header + tab strip + one primary CTA, with the active
 * tab's existing page rendered underneath as `children`. Wrapping existing
 * routes with a ProgramHub is pure layout — it never changes what the child
 * page fetches, renders, or submits.
 *
 * The active tab is derived from the current wouter location; clicking a tab
 * is a plain <Link> navigation, so URLs remain deep-linkable and every route
 * the sidebar used to expose still resolves to the same page.
 */
export function ProgramHub({
  title,
  icon: Icon,
  subtitle,
  primaryAction,
  tabs,
  children,
}: ProgramHubProps) {
  const [location] = useLocation();
  const { role } = useAuth();

  const visibleTabs = tabs.filter((t) =>
    !t.roles || (role ? (t.roles as string[]).includes(role) : false),
  );

  // Longest-match so deep links like /prenatal/registry land on the Registry
  // tab rather than the top-level /prenatal tab. Ties broken by declaration
  // order — hub authors put the "base" path last if needed.
  const activeTab =
    [...visibleTabs]
      .sort((a, b) => b.path.length - a.path.length)
      .find((t) => location === t.path || location.startsWith(`${t.path}/`)) ??
    visibleTabs[0];

  const Ac = primaryAction?.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight" data-testid="hub-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {primaryAction && permissions.canEnterRecords(role) && (
          <Button asChild data-testid="hub-primary-action">
            <Link href={primaryAction.path}>
              {Ac ? <Ac className="h-4 w-4 mr-2" /> : null}
              {primaryAction.label}
            </Link>
          </Button>
        )}
      </div>

      {visibleTabs.length > 1 && (
        <div
          className="flex items-center gap-1 border-b border-border overflow-x-auto"
          role="tablist"
          data-testid="hub-tabs"
        >
          {visibleTabs.map((t) => {
            const isActive = activeTab?.path === t.path;
            return (
              <Link
                key={t.path}
                href={t.path}
                role="tab"
                aria-selected={isActive}
                data-active={isActive}
                data-testid={t.testId ?? `hub-tab-${t.path.replace(/\W+/g, "-")}`}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  "border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}
