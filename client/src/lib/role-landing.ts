import { UserRole } from "@/hooks/use-auth";

/**
 * Where each role lands right after login.
 *
 * - BHW/TL → /today: an action-oriented overview of urgent patients and
 *   today's schedule, scoped to their assigned barangay.
 * - MHO / SHA / SYSTEM_ADMIN → /dashboards: the decision-making surface
 *   (municipal KPIs, program dashboards, outbreak map, hotspots).
 *
 * Centralising the map keeps the login flow (landing.tsx) and any route
 * guards in sync.
 */
export const DEFAULT_LANDING_BY_ROLE: Record<string, string> = {
  [UserRole.SYSTEM_ADMIN]: "/dashboards",
  [UserRole.MHO]: "/dashboards",
  [UserRole.SHA]: "/dashboards",
  [UserRole.TL]: "/today",
};

export function getDefaultLandingForRole(role: string | null | undefined): string {
  if (!role) return "/dashboards";
  return DEFAULT_LANDING_BY_ROLE[role] ?? "/dashboards";
}
