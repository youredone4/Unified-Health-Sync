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
import { useAuth, permissions } from "@/hooks/use-auth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  isBadged?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Navigation config — roles are NOT listed here.
// Visibility is derived from ROUTE_PERMISSIONS in use-auth.ts via permissions.canAccessRoute(),
// keeping sidebar display and route guards in sync from a single source of truth.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Municipal Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Hotspots & Analytics", url: "/hotspots", icon: TrendingUp },
      { title: "Calendar", url: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Maternal and Child Care",
    items: [
      { title: "TT Reminders", url: "/prenatal", icon: Heart },
      { title: "Prenatal Dashboard", url: "/prenatal/dashboard", icon: Activity },
      { title: "Mother Registry", url: "/prenatal/registry", icon: Users },
      { title: "Vaccination Schedule", url: "/child", icon: Baby },
      { title: "Child Dashboard", url: "/child/dashboard", icon: Activity },
      { title: "Child Registry", url: "/child/registry", icon: Users },
    ],
  },
  {
    label: "Community Nutrition",
    items: [
      { title: "Growth Monitoring", url: "/nutrition/growth", icon: TrendingUp },
      { title: "Nutrition Dashboard", url: "/nutrition/dashboard", icon: Activity },
      { title: "Underweight Follow-ups", url: "/nutrition", icon: Scale },
    ],
  },
  {
    label: "Senior Care",
    items: [
      { title: "HTN Meds Pickup", url: "/senior", icon: Pill },
      { title: "Senior Dashboard", url: "/senior/dashboard", icon: Activity },
      { title: "Senior Registry", url: "/senior/registry", icon: UserCircle },
    ],
  },
  {
    label: "Disease Surveillance",
    items: [
      { title: "Case Worklist", url: "/disease", icon: Siren },
      { title: "Case Registry", url: "/disease/registry", icon: ClipboardList },
      { title: "Outbreak Map", url: "/disease/map", icon: MapPin },
    ],
  },
  {
    label: "TB DOTS",
    items: [
      { title: "DOTS Worklist", url: "/tb", icon: Pill },
      { title: "TB Registry", url: "/tb/registry", icon: ClipboardList },
    ],
  },
  {
    label: "Inventory and Supply",
    items: [
      { title: "Availability & Surplus", url: "/inventory", icon: Package },
      { title: "Stock-outs & Low Stock", url: "/inventory/stockouts", icon: AlertTriangle },
    ],
  },
  {
    label: "Reports and Analytics",
    items: [
      { title: "M1 Report", url: "/reports/m1", icon: ClipboardList },
      { title: "Health Analytics", url: "/reports/ai", icon: Bot },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageCircle, isBadged: true },
    ],
  },
  {
    label: "Clinical Services",
    items: [
      { title: "Patient Check-up", url: "/patient-checkup", icon: ClipboardPlus },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "User Management", url: "/admin/users", icon: Users },
      { title: "Audit Logs", url: "/admin/audit", icon: Shield },
      { title: "Settings", url: "/settings", icon: Settings },
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

  // Filter items and groups using the centralized ROUTE_PERMISSIONS via canAccessRoute.
  // This is the same check the RoleRoute guard uses — one source of truth.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.canAccessRoute(role, item.url)),
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
