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

// Permission helpers
export const permissions = {
  canManageUsers: (role?: string) => role === UserRole.SYSTEM_ADMIN,
  canAccessPatientCheckup: (role?: string) => role === UserRole.SYSTEM_ADMIN || role === UserRole.MHO,
  canViewAuditLogs: (role?: string) => role === UserRole.SYSTEM_ADMIN,
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
  };
}
