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

// ─── Central route-permission map ────────────────────────────────────────────
// Single source of truth used by BOTH the sidebar (item visibility) and route
// guards (RoleRoute). Routes not listed here are accessible to all authenticated
// users. SYSTEM_ADMIN always has full access (short-circuited below).
export const ROUTE_PERMISSIONS: Record<string, readonly string[]> = {
  "/patient-checkup": [UserRole.SYSTEM_ADMIN, UserRole.MHO],
  "/settings": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/hotspots": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/inventory": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/inventory/stockouts": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/reports": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/reports/ai": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/reports/m1": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/disease/map": [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  "/admin/users": [UserRole.SYSTEM_ADMIN],
  "/admin/audit": [UserRole.SYSTEM_ADMIN],
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
  canCreate: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.TL,
  canUpdate: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.TL,
  canDelete: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  canEditInventory: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  isAdmin: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  isMHO: (role?: string) => role === UserRole.MHO,
  isSHA: (role?: string) => role === UserRole.SHA,
  isTL: (role?: string) => role === UserRole.TL,

  // Derived from ROUTE_PERMISSIONS — used by both sidebar item filter and RoleRoute guard
  canAccessRoute: (role: string | undefined, path: string): boolean => {
    if (!role) return false;
    // SYSTEM_ADMIN has full access to every route
    if (role === UserRole.SYSTEM_ADMIN) return true;
    // Find the most-specific matching permission entry (longest prefix wins)
    const entry = Object.entries(ROUTE_PERMISSIONS)
      .filter(([pattern]) => path === pattern || path.startsWith(pattern + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0];
    // No entry = unrestricted route, accessible to all authenticated roles
    if (!entry) return true;
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
