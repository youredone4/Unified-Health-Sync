import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatusPillTone = "danger" | "warning" | "info" | "success" | "muted";

export interface StatusPill {
  label: string;
  tone: StatusPillTone;
  icon?: React.ElementType;
  testId?: string;
}

export interface ProfilePrimaryAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export interface ProfileOverflowAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  destructive?: boolean;
  testId?: string;
}

export interface ProfileTab {
  /** Canonical tab value — "profile" / "transactions" / "clinical". */
  value: string;
  /** Display label. Keep short. */
  label: string;
  element: ReactNode;
  testId?: string;
}

interface PatientProfileShellProps {
  backHref: string;
  backLabel: string;
  name: string;
  /** Second-line demographics summary, e.g. "68 yrs · Female · Brgy San Isidro · 0917-…" */
  subtitle?: string;
  /** Optional type badge shown next to the name (e.g. "Pulmonary TB"). */
  typeBadges?: ReactNode;
  /** Pills shown below the header; hidden entirely when the array is empty. */
  statusPills?: StatusPill[];
  /** Optional always-visible "at a glance" card content (e.g. key vitals). */
  atAGlance?: ReactNode;
  primaryAction?: ProfilePrimaryAction;
  overflowActions?: ProfileOverflowAction[];
  /**
   * Uniform profile tab set — defaults to Profile / Transactions / Clinical.
   * Pages always pass all three so the skeleton stays predictable across
   * Mother, Child, Senior, TB, Disease.
   */
  tabs: ProfileTab[];
  defaultTab?: string;
}

const PILL_TONE_CLASSES: Record<StatusPillTone, string> = {
  danger: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  muted: "border-border bg-muted text-muted-foreground",
};

/**
 * Uniform shell for every patient profile (Mother, Child, Senior, TB,
 * Disease). Owns layout only — each profile keeps its own queries,
 * mutations, modals, and per-tab content. Desktop renders as <Tabs>; at
 * < md widths the same sections render as a stacked <Accordion> so the UI
 * never horizontally-scrolls on a BHW's phone.
 */
export function PatientProfileShell({
  backHref,
  backLabel,
  name,
  subtitle,
  typeBadges,
  statusPills = [],
  atAGlance,
  primaryAction,
  overflowActions = [],
  tabs,
  defaultTab,
}: PatientProfileShellProps) {
  const PAIcon = primaryAction?.icon;
  const resolvedDefault = defaultTab ?? tabs[0]?.value;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" asChild className="gap-2 -ml-2" data-testid="button-back">
        <Link href={backHref}>
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      </Button>

      {/* Header: identity + primary action + overflow */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold leading-tight" data-testid="profile-name">
              {name}
            </h1>
            {typeBadges}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="gap-2"
              data-testid={primaryAction.testId ?? "profile-primary-action"}
            >
              {PAIcon ? <PAIcon className="w-4 h-4" /> : null}
              {primaryAction.label}
            </Button>
          )}
          {overflowActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="profile-overflow">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflowActions.map((a, i) => {
                  const Icon = a.icon;
                  const prev = overflowActions[i - 1];
                  // Insert a separator just before the first destructive entry
                  // so Delete feels distinct from Edit.
                  const needsSep = a.destructive && prev && !prev.destructive;
                  return (
                    <span key={a.label}>
                      {needsSep ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        onClick={a.onClick}
                        className={a.destructive ? "text-destructive focus:text-destructive" : undefined}
                        data-testid={a.testId ?? `profile-action-${a.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {Icon ? <Icon className="w-4 h-4 mr-2" /> : null}
                        {a.label}
                      </DropdownMenuItem>
                    </span>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Status pills (optional) */}
      {statusPills.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="profile-status-pills">
          {statusPills.map((p) => {
            const Icon = p.icon;
            return (
              <Badge
                key={p.label}
                variant="outline"
                className={cn("gap-1", PILL_TONE_CLASSES[p.tone])}
                data-testid={p.testId}
              >
                {Icon ? <Icon className="w-3 h-3" /> : null}
                {p.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* At-a-glance card (optional) */}
      {atAGlance && (
        <Card data-testid="profile-at-a-glance">
          <CardContent className="py-4">{atAGlance}</CardContent>
        </Card>
      )}

      {/* Tabs (desktop) */}
      <div className="hidden md:block">
        <Tabs defaultValue={resolvedDefault}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                data-testid={t.testId ?? `tab-${t.value}`}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {t.element}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Accordion (mobile) */}
      <div className="md:hidden">
        <Accordion type="single" collapsible defaultValue={resolvedDefault}>
          {tabs.map((t) => (
            <AccordionItem key={t.value} value={t.value}>
              <AccordionTrigger data-testid={`accordion-${t.value}`}>
                {t.label}
              </AccordionTrigger>
              <AccordionContent>{t.element}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

/** Small helper for the "at a glance" grid. Keeps card children consistent
 * across profiles. */
export function GlanceGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass =
    cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4";
  return <dl className={`grid ${colClass} gap-x-4 gap-y-3 text-sm`}>{children}</dl>;
}

export function GlanceCell({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
