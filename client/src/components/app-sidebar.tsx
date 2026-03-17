import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  MapPin,
  Baby,
  Heart,
  Users,
  Package,
  Calendar,
  Activity,
  Stethoscope,
  UserCircle,
  Scale,
  Pill,
  TrendingUp,
  AlertTriangle,
  Bot,
  Siren,
  ClipboardList,
  Settings,
  Shield,
  ClipboardPlus,
  MessageCircle,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth, UserRole } from "@/hooks/use-auth";

// Role shorthand arrays for the nav config
const ALL = [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL] as const;
const MGMT = [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA] as const;
const ADMIN_MHO = [UserRole.SYSTEM_ADMIN, UserRole.MHO] as const;
const ADMIN_ONLY = [UserRole.SYSTEM_ADMIN] as const;

type Role = (typeof ALL)[number];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: readonly Role[];
  isBadged?: boolean; // special flag — sidebar renders unread badge for Messages
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Central role-to-menu configuration — single source of truth
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Municipal Dashboard", url: "/", icon: LayoutDashboard, roles: ALL },
      { title: "Hotspots & Analytics", url: "/hotspots", icon: TrendingUp, roles: MGMT },
      { title: "Calendar", url: "/calendar", icon: Calendar, roles: ALL },
    ],
  },
  {
    label: "Maternal and Child Care",
    items: [
      { title: "TT Reminders", url: "/prenatal", icon: Heart, roles: ALL },
      { title: "Prenatal Dashboard", url: "/prenatal/dashboard", icon: Activity, roles: ALL },
      { title: "Mother Registry", url: "/prenatal/registry", icon: Users, roles: ALL },
      { title: "Vaccination Schedule", url: "/child", icon: Baby, roles: ALL },
      { title: "Child Dashboard", url: "/child/dashboard", icon: Activity, roles: ALL },
      { title: "Child Registry", url: "/child/registry", icon: Users, roles: ALL },
    ],
  },
  {
    label: "Community Nutrition",
    items: [
      { title: "Growth Monitoring", url: "/nutrition/growth", icon: TrendingUp, roles: ALL },
      { title: "Nutrition Dashboard", url: "/nutrition/dashboard", icon: Activity, roles: ALL },
      { title: "Underweight Follow-ups", url: "/nutrition", icon: Scale, roles: ALL },
    ],
  },
  {
    label: "Senior Care",
    items: [
      { title: "HTN Meds Pickup", url: "/senior", icon: Pill, roles: ALL },
      { title: "Senior Dashboard", url: "/senior/dashboard", icon: Activity, roles: ALL },
      { title: "Senior Registry", url: "/senior/registry", icon: UserCircle, roles: ALL },
    ],
  },
  {
    label: "Disease Surveillance",
    items: [
      { title: "Case Worklist", url: "/disease", icon: Siren, roles: ALL },
      { title: "Case Registry", url: "/disease/registry", icon: ClipboardList, roles: ALL },
      { title: "Outbreak Map", url: "/disease/map", icon: MapPin, roles: MGMT },
    ],
  },
  {
    label: "TB DOTS",
    items: [
      { title: "DOTS Worklist", url: "/tb", icon: Pill, roles: ALL },
      { title: "TB Registry", url: "/tb/registry", icon: ClipboardList, roles: ALL },
    ],
  },
  {
    label: "Inventory and Supply",
    items: [
      { title: "Availability & Surplus", url: "/inventory", icon: Package, roles: MGMT },
      { title: "Stock-outs & Low Stock", url: "/inventory/stockouts", icon: AlertTriangle, roles: MGMT },
    ],
  },
  {
    label: "Reports and Analytics",
    items: [
      { title: "M1 Report", url: "/reports/m1", icon: ClipboardList, roles: MGMT },
      { title: "Health Analytics", url: "/reports/ai", icon: Bot, roles: MGMT },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageCircle, roles: ALL, isBadged: true },
    ],
  },
  {
    label: "Clinical Services",
    items: [
      { title: "Patient Check-up", url: "/patient-checkup", icon: ClipboardPlus, roles: ADMIN_MHO },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "User Management", url: "/admin/users", icon: Users, roles: ADMIN_ONLY },
      { title: "Audit Logs", url: "/admin/audit", icon: Shield, roles: ADMIN_ONLY },
      { title: "Settings", url: "/settings", icon: Settings, roles: MGMT },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { settings } = useTheme();
  const { role, isAuthenticated } = useAuth();
  const [logoError, setLogoError] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 5000,
    enabled: isAuthenticated,
  });

  const lguName = settings?.lguName || "HealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";
  const logoUrl = settings?.logoUrl;
  const showLogo = logoUrl && !logoError;

  // Filter items to only those the current user's role can see
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      role ? (item.roles as readonly string[]).includes(role) : false
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          {showLogo ? (
            <img
              src={logoUrl}
              alt="LGU Logo"
              className="w-8 h-8 object-contain rounded"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Stethoscope className="w-6 h-6 text-primary" />
          )}
          <div>
            <h1 className="text-base font-semibold" data-testid="text-lgu-name">{lguName}</h1>
            <p className="text-xs text-muted-foreground" data-testid="text-lgu-subtitle">{lguSubtitle}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url}
                      className="data-[active=true]:bg-sidebar-accent"
                    >
                      <Link href={item.url} data-testid={`nav-${item.url.replace(/\//g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.isBadged && (unreadData?.count ?? 0) > 0 && (
                          <Badge
                            className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs px-1"
                            data-testid="badge-unread-messages"
                          >
                            {unreadData!.count}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
