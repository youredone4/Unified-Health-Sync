import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  User,
  HeartHandshake,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth, sidebarPermissions, ALL_ROLES } from "@/hooks/use-auth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  // Explicit roles list derived from sidebarPermissions (or ALL_ROLES for unrestricted items).
  // Used to filter items at render time — same data that RoleRoute uses for route guards.
  roles: readonly string[];
  isBadged?: boolean;
}

interface NavGroup {
  label: string | null; // null = no subgroup label rendered
  items: NavItem[];
}

// Three zones map to the three modes of work (see docs/ui-design-system.md §2):
//   TRANSACTIONS = record / update / log
//   DASHBOARDS   = at-a-glance decision making
//   REPORTS      = formal outputs to submit / export
// Admin items sit in their own zone below the three, matching the design doc's
// "— Admin —" separator.
type ZoneKey = "TRANSACTIONS" | "DASHBOARDS" | "REPORTS" | "ADMIN";

interface NavZone {
  key: ZoneKey;
  label: string;
  groups: NavGroup[];
}

// Helper: returns the allowed roles for a path from the central sidebarPermissions map,
// falling back to ALL_ROLES for paths that have no restriction.
function rolesFor(url: string): readonly string[] {
  return sidebarPermissions[url] ?? ALL_ROLES;
}

// Central navigation config — roles on each item come from sidebarPermissions so that
// sidebar visibility and RoleRoute guards share the same policy data.
const NAV_ZONES: NavZone[] = [
  {
    key: "TRANSACTIONS",
    label: "Transactions",
    groups: [
      {
        label: "Maternal & Child Care",
        items: [
          { title: "TT Reminders", url: "/prenatal", icon: Heart, roles: rolesFor("/prenatal") },
          { title: "Mother Registry", url: "/prenatal/registry", icon: Users, roles: rolesFor("/prenatal/registry") },
          { title: "Vaccination Schedule", url: "/child", icon: Baby, roles: rolesFor("/child") },
          { title: "Child Registry", url: "/child/registry", icon: Users, roles: rolesFor("/child/registry") },
        ],
      },
      {
        label: "Family Planning",
        items: [
          { title: "FP Registry", url: "/fp", icon: HeartHandshake, roles: rolesFor("/fp") },
        ],
      },
      {
        label: "Nutrition",
        items: [
          { title: "Underweight Follow-ups", url: "/nutrition", icon: Scale, roles: rolesFor("/nutrition") },
        ],
      },
      {
        label: "Senior Care",
        items: [
          { title: "HTN Meds Pickup", url: "/senior", icon: Pill, roles: rolesFor("/senior") },
          { title: "Senior Registry", url: "/senior/registry", icon: UserCircle, roles: rolesFor("/senior/registry") },
        ],
      },
      {
        label: "Disease Surveillance",
        items: [
          { title: "Case Worklist", url: "/disease", icon: Siren, roles: rolesFor("/disease") },
          { title: "Case Registry", url: "/disease/registry", icon: ClipboardList, roles: rolesFor("/disease/registry") },
        ],
      },
      {
        label: "TB DOTS",
        items: [
          { title: "DOTS Worklist", url: "/tb", icon: Pill, roles: rolesFor("/tb") },
          { title: "TB Registry", url: "/tb/registry", icon: ClipboardList, roles: rolesFor("/tb/registry") },
        ],
      },
      {
        label: "Clinical Services",
        items: [
          { title: "Patient Check-up", url: "/patient-checkup", icon: ClipboardPlus, roles: rolesFor("/patient-checkup") },
        ],
      },
      {
        label: "Inventory",
        items: [
          { title: "Availability & Surplus", url: "/inventory", icon: Package, roles: rolesFor("/inventory") },
        ],
      },
      {
        label: "Scheduling",
        items: [
          { title: "Calendar", url: "/calendar", icon: Calendar, roles: rolesFor("/calendar") },
        ],
      },
      {
        label: "Monthly Encoding",
        items: [
          { title: "M1 Encoding", url: "/m1/encode", icon: ClipboardList, roles: rolesFor("/m1/encode") },
        ],
      },
      {
        label: "Communication",
        items: [
          { title: "Messages", url: "/messages", icon: MessageCircle, roles: rolesFor("/messages"), isBadged: true },
        ],
      },
    ],
  },
  {
    key: "DASHBOARDS",
    label: "Dashboards",
    groups: [
      {
        label: "Municipal",
        items: [
          { title: "Municipal Dashboard", url: "/", icon: LayoutDashboard, roles: rolesFor("/") },
          { title: "Hotspots & Analytics", url: "/hotspots", icon: TrendingUp, roles: rolesFor("/hotspots") },
        ],
      },
      {
        label: "Maternal & Child",
        items: [
          { title: "Prenatal Dashboard", url: "/prenatal/dashboard", icon: Activity, roles: rolesFor("/prenatal/dashboard") },
          { title: "Child Dashboard", url: "/child/dashboard", icon: Activity, roles: rolesFor("/child/dashboard") },
        ],
      },
      {
        label: "Nutrition",
        items: [
          { title: "Growth Monitoring", url: "/nutrition/growth", icon: TrendingUp, roles: rolesFor("/nutrition/growth") },
          { title: "Nutrition Dashboard", url: "/nutrition/dashboard", icon: Activity, roles: rolesFor("/nutrition/dashboard") },
        ],
      },
      {
        label: "Senior Care",
        items: [
          { title: "Senior Dashboard", url: "/senior/dashboard", icon: Activity, roles: rolesFor("/senior/dashboard") },
        ],
      },
      {
        label: "Disease Surveillance",
        items: [
          { title: "Outbreak Map", url: "/disease/map", icon: MapPin, roles: rolesFor("/disease/map") },
        ],
      },
      {
        label: "Inventory",
        items: [
          { title: "Stock-outs & Low Stock", url: "/inventory/stockouts", icon: AlertTriangle, roles: rolesFor("/inventory/stockouts") },
        ],
      },
    ],
  },
  {
    key: "REPORTS",
    label: "Reports",
    groups: [
      {
        label: null,
        items: [
          { title: "M1 Brgy Summary & Export", url: "/reports/m1", icon: ClipboardList, roles: rolesFor("/reports/m1") },
          { title: "Health Analytics", url: "/reports/ai", icon: Bot, roles: rolesFor("/reports/ai") },
        ],
      },
    ],
  },
  {
    key: "ADMIN",
    label: "Admin",
    groups: [
      {
        label: null,
        items: [
          { title: "User Management", url: "/admin/users", icon: Users, roles: rolesFor("/admin/users") },
          { title: "Audit Logs", url: "/admin/audit", icon: Shield, roles: rolesFor("/admin/audit") },
          { title: "Settings", url: "/settings", icon: Settings, roles: rolesFor("/settings") },
        ],
      },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { settings } = useTheme();
  const { role, isAuthenticated, isTL } = useAuth();
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

  // Filter each zone's groups to items the current role can see; drop groups
  // with no visible items; drop zones with no visible groups.
  const visibleZones = NAV_ZONES.map((zone) => ({
    ...zone,
    groups: zone.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          role ? (item.roles as string[]).includes(role) : false
        ),
      }))
      .filter((group) => group.items.length > 0),
  })).filter((zone) => zone.groups.length > 0);

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
        {visibleZones.map((zone, zoneIndex) => (
          <div key={zone.key} data-testid={`zone-${zone.key.toLowerCase()}`}>
            <div
              className={
                "px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" +
                (zoneIndex > 0 ? " mt-2 border-t border-sidebar-border" : "")
              }
            >
              {zone.label}
            </div>
            {zone.groups.map((group, groupIndex) => (
              <SidebarGroup key={`${zone.key}-${group.label ?? groupIndex}`}>
                {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const displayTitle = item.url === "/" && isTL
                        ? "Barangay Dashboard"
                        : item.title;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            data-active={location === item.url}
                            className="data-[active=true]:bg-sidebar-accent"
                          >
                            <Link href={item.url} data-testid={`nav-${item.url.replace(/\//g, "-")}`}>
                              <item.icon className="w-4 h-4" />
                              <span>{displayTitle}</span>
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
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </div>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              data-active={location === "/account"}
              className="data-[active=true]:bg-sidebar-accent"
            >
              <Link href="/account" data-testid="nav-account">
                <User className="w-4 h-4" />
                <span>My Account</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
