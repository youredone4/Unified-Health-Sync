import { UserRole } from "@/hooks/use-auth";

/**
 * Where each role lands right after login. Keeps the login redirect path in one
 * place so a future Stage (e.g. a dedicated "Today" page for BHWs/TLs) can
 * change this without touching the auth flow.
 *
 * For now every role resolves to the Municipal Dashboard, which is already
 * auto-scoped to a TL's assigned barangay.
 */
export const DEFAULT_LANDING_BY_ROLE: Record<string, string> = {
  [UserRole.SYSTEM_ADMIN]: "/",
  [UserRole.MHO]: "/",
  [UserRole.SHA]: "/",
  [UserRole.TL]: "/",
};

export function getDefaultLandingForRole(role: string | null | undefined): string {
  if (!role) return "/";
  return DEFAULT_LANDING_BY_ROLE[role] ?? "/";
}
