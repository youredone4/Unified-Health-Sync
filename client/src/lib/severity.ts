import { cva, type VariantProps } from "class-variance-authority";

/**
 * Severity tokens — single source of truth for the urgency-driven color
 * scheme used across the operational surfaces (Today priority list, MGMT
 * inbox, outbreak status badges, AEFI severity chips).
 *
 * Use these instead of hand-rolling Tailwind color literals so urgency
 * stays consistent across the app and dark-mode pairings stay correct.
 *
 * Mapping convention:
 *   high   → red    (overdue, SERIOUS, SUSPECTED outbreak)
 *   medium → amber  (due today, CONTAINED outbreak, NON_SERIOUS AEFI)
 *   low    → sky    (upcoming, informational)
 *   ok     → emerald (resolved, completed, all-clear)
 */

export type Severity = "high" | "medium" | "low" | "ok";

// Card / panel — bordered tinted surface used for inbox banner + priority sections
export const severityCard = cva(
  "border-2 transition-colors",
  {
    variants: {
      severity: {
        high:   "border-red-500/30 bg-red-500/5",
        medium: "border-amber-500/30 bg-amber-500/5",
        low:    "border-sky-500/30 bg-sky-500/5",
        ok:     "border-emerald-500/30 bg-emerald-500/5",
      },
    },
    defaultVariants: { severity: "low" },
  },
);

// Section header icon color
export const severityIcon = cva("", {
  variants: {
    severity: {
      high:   "text-red-600 dark:text-red-400",
      medium: "text-amber-600 dark:text-amber-400",
      low:    "text-sky-600 dark:text-sky-400",
      ok:     "text-emerald-600 dark:text-emerald-400",
    },
  },
  defaultVariants: { severity: "low" },
});

// Solid pill / dot — used for the small status indicators on rows
export const severityDot = cva("rounded-full shrink-0", {
  variants: {
    severity: {
      high:   "bg-red-500",
      medium: "bg-amber-500",
      low:    "bg-sky-500",
      ok:     "bg-emerald-500",
    },
    size: {
      sm: "w-1.5 h-1.5",
      md: "w-2 h-2",
      lg: "w-2.5 h-2.5",
    },
  },
  defaultVariants: { severity: "low", size: "md" },
});

// Tinted badge — for priority chips on inbox items
export const severityBadge = cva("rounded text-xs font-medium px-2 py-0.5", {
  variants: {
    severity: {
      high:   "bg-red-500/15 text-red-700 dark:text-red-300",
      medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      low:    "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      ok:     "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
  },
  defaultVariants: { severity: "low" },
});

export type SeverityCardProps = VariantProps<typeof severityCard>;
export type SeverityIconProps = VariantProps<typeof severityIcon>;
export type SeverityDotProps = VariantProps<typeof severityDot>;
export type SeverityBadgeProps = VariantProps<typeof severityBadge>;
