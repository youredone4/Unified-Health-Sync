import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/models/auth";

// Extended user info with role and barangay assignments
export interface AuthUser extends User {
  role: string;
  status: string;
  assignedBarangays: string[];
}

// Store last login info for the landing page
function saveLastLoginInfo(user: AuthUser | null) {
  if (user) {
    localStorage.setItem("lastLoginInfo", JSON.stringify({
      role: user.role,
      barangay: user.assignedBarangays?.[0] || null,
    }));
  }
}

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

// Role constants
export const UserRole = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  MHO: "MHO",
  SHA: "SHA",
  TL: "TL",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Reusable role arrays for use in sidebar config and route guard allowedRoles
export const ALL_ROLES = [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL] as const;
export const MGMT_ROLES = [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA] as const;
export const ADMIN_MHO_ROLES = [UserRole.SYSTEM_ADMIN, UserRole.MHO] as const;
export const ADMIN_ONLY_ROLES = [UserRole.SYSTEM_ADMIN] as const;

// ─── Central sidebar / route permission config ────────────────────────────────
// Single source of truth: a map of path → allowed roles.
// Used directly in sidebarPermissions config items AND consumed by RoleRoute
// via allowedRoles props.  Unlisted paths are publicly accessible to all roles.
export const sidebarPermissions: Record<string, readonly string[]> = {
  "/today": ALL_ROLES,
  "/dashboards": ALL_ROLES,
  "/hotspots": MGMT_ROLES,
  "/inventory": ALL_ROLES,
  "/inventory/stockouts": MGMT_ROLES,
  "/inventory/dispensings": ALL_ROLES,    // Pharmacy hub Dispensings tab; TLs see only their barangay (server-enforced)
  "/walk-in": ALL_ROLES,
  "/restock-requests": ALL_ROLES,
  "/certificates": ALL_ROLES,
  "/campaigns": ALL_ROLES,
  "/konsulta": ALL_ROLES,
  "/aefi": ALL_ROLES,                    // legacy URL — redirects into the hub
  "/immunization": ALL_ROLES,            // unified Group 3 hub
  "/death-events": MGMT_ROLES,           // legacy URL — redirects into the hub
  "/mortality-hub": ALL_ROLES,           // unified Group 2 hub; tab visibility is role-aware inside the page
  "/pidsr": ALL_ROLES,
  "/cold-chain": ALL_ROLES,
  "/school-immunizations": ALL_ROLES,
  "/oral-health": ALL_ROLES,
  "/ncd-screenings": ALL_ROLES,
  "/workforce": MGMT_ROLES,
  "/referrals": ALL_ROLES,
  "/mgmt-inbox": MGMT_ROLES,
  "/outbreaks": ALL_ROLES,
  "/disease-surveillance": ALL_ROLES,
  "/mortality": ALL_ROLES,
  "/household-water": ALL_ROLES,
  "/reports": ALL_ROLES,
  "/reports/ai": MGMT_ROLES,
  "/reports/m1": ALL_ROLES,
  "/disease/map": MGMT_ROLES,
  "/patient-checkup": ADMIN_MHO_ROLES,
  "/settings": MGMT_ROLES,
  "/admin/users": ADMIN_ONLY_ROLES,
  "/admin/audit": ADMIN_ONLY_ROLES,
};

// Permission helpers — all role logic lives here
export const permissions = {
  canManageUsers: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  canAccessPatientCheckup: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO,
  canViewAuditLogs: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  canAccessSettings: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO || role === UserRole.SHA,
  canAccessManagement: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO || role === UserRole.SHA,
  canGenerateReports: (role?: string) => !!role,
  canImportReports: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO,
  canCreate: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO || role === UserRole.SHA || role === UserRole.TL,
  canUpdate: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO || role === UserRole.SHA || role === UserRole.TL,
  // Encode-level access for transactional/clinical entry (mothers, children,
  // disease cases, FP records, mortality, screenings, household water, etc.).
  // Per DOH operational model: BHS-level TLs capture, RHU-level MGMT reviews.
  // MGMT roles see consolidated data but cannot add new records — they
  // validate + sign off + submit. Server-side enforcement still governs
  // mutation routes; this helper drives the UI affordance.
  canEnterRecords: (role?: string) => role === UserRole.TL,
  canDelete: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  canEditInventory: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  isAdmin: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  isMHO: (role?: string) => role === UserRole.MHO,
  isSHA: (role?: string) => role === UserRole.SHA,
  isTL: (role?: string) => role === UserRole.TL,

  // Checks if a role can access a given URL path — used by RoleRoute for guard logic.
  // Derived from sidebarPermissions so sidebar visibility and route access always agree.
  canAccessRoute: (role: string | undefined, path: string): boolean => {
    if (!role) return false;
    if (role === UserRole.SYSTEM_ADMIN) return true;
    // Longest-prefix match in sidebarPermissions
    const entry = Object.entries(sidebarPermissions)
      .filter(([pattern]) => path === pattern || path.startsWith(pattern + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (!entry) return true; // unrestricted = accessible to all authenticated roles
    return (entry[1] as string[]).includes(role);
  },
};

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Save last login info for the landing page logo
  useEffect(() => {
    if (user) {
      saveLastLoginInfo(user);
    }
  }, [user]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
    // Role helpers
    role: user?.role,
    isAdmin: permissions.isAdmin(user?.role),
    isMHO: permissions.isMHO(user?.role),
    isSHA: permissions.isSHA(user?.role),
    isTL: permissions.isTL(user?.role),
    assignedBarangays: user?.assignedBarangays || [],
    // Permission helpers
    canManageUsers: permissions.canManageUsers(user?.role),
    canAccessPatientCheckup: permissions.canAccessPatientCheckup(user?.role),
    canViewAuditLogs: permissions.canViewAuditLogs(user?.role),
    canAccessSettings: permissions.canAccessSettings(user?.role),
    canAccessManagement: permissions.canAccessManagement(user?.role),
  };
}
