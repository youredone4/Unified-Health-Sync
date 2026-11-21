/**
 * What each account role is called on screen. One list, so the header, the
 * account page, user administration and messages cannot drift apart (the
 * same role used to be shown under three different names).
 *
 * The keys are the role codes stored in the database and checked by the
 * server; they are not shown to users and must not be renamed here.
 *
 * About "SHA": it is an internal code kept from an early draft. The role is
 * for Rural Health Unit staff who work across all barangays under the MHO:
 * they consolidate barangay reports and follow up referrals and
 * surveillance. In a Philippine RHU that is the Public Health Nurse, so
 * that is the name shown. Barangay nurses (TL) see only their assigned
 * barangays; a nurse assigned to the RHU itself gets this role instead.
 */
export const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  MHO: "Municipal Health Officer",
  SHA: "Public Health Nurse (RHU)",
  TL: "Team Leader (Barangay Nurse)",
  MAYOR: "Municipal Mayor (view-only)",
  HEALTH_COMMITTEE: "SB Committee on Health & Sanitation (view-only)",
};

/** Short forms for badges and message bylines. */
export const ROLE_BADGES: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  MHO: "MHO",
  SHA: "PHN",
  TL: "Team Leader (Barangay Nurse)",
  MAYOR: "Mayor",
  HEALTH_COMMITTEE: "Health Committee",
};

export function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role]) || role || "—";
}

export function roleBadge(role: string | null | undefined): string {
  return (role && ROLE_BADGES[role]) || role || "—";
}
