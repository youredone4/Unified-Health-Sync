import { useState } from "react";
import { Link, useLocation } from "wouter";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  MapPin,
  Baby,
  Heart,
  Users,
  Package,
  FileText,
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
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";

const menuGroups = [
  {
    label: "Overview",
    items: [
      { title: "Municipal Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Hotspots & Analytics", url: "/hotspots", icon: TrendingUp },
      { title: "Calendar", url: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Prenatal Module",
    items: [
      { title: "TT Reminders", url: "/prenatal", icon: Heart },
      { title: "Prenatal Dashboard", url: "/prenatal/dashboard", icon: Activity },
      { title: "Mother Registry", url: "/prenatal/registry", icon: Users },
    ],
  },
  {
    label: "Child Health Module",
    items: [
      { title: "Vaccination Schedule", url: "/child", icon: Baby },
      { title: "Child Dashboard", url: "/child/dashboard", icon: Activity },
      { title: "Child Registry", url: "/child/registry", icon: Users },
    ],
  },
  {
    label: "Nutrition Module",
    items: [
      { title: "Underweight Follow-ups", url: "/nutrition", icon: Scale },
      { title: "Growth Monitoring", url: "/nutrition/growth", icon: TrendingUp },
      { title: "Nutrition Dashboard", url: "/nutrition/dashboard", icon: Activity },
    ],
  },
  {
    label: "Senior Care Module",
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
    label: "TB DOTS Module",
    items: [
      { title: "DOTS Worklist", url: "/tb", icon: Pill },
      { title: "TB Registry", url: "/tb/registry", icon: ClipboardList },
    ],
  },
  {
    label: "Inventory Module",
    items: [
      { title: "Availability & Surplus", url: "/inventory", icon: Package },
      { title: "Stock-outs & Low Stock", url: "/inventory/stockouts", icon: AlertTriangle },
    ],
  },
  {
    label: "Reporting Module",
    items: [
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "M1 Report", url: "/reports/m1", icon: ClipboardList },
      { title: "AI Reporting", url: "/reports/ai", icon: Bot },
    ],
  },
  {
    label: "Map Module",
    items: [
      { title: "Health Facilities Map", url: "/map", icon: MapPin },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { settings } = useTheme();
  const { canManageUsers, canViewAuditLogs, canAccessPatientCheckup } = useAuth();
  const [logoError, setLogoError] = useState(false);

  const lguName = settings?.lguName || "HealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";
  const logoUrl = settings?.logoUrl;
  const showLogo = logoUrl && !logoError;

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
        {menuGroups.map((group) => (
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
                      <Link href={item.url} data-testid={`nav-${item.url.replace(/\//g, '-')}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <SidebarMenu>
          {canAccessPatientCheckup && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                data-active={location === "/patient-checkup"}
                className="data-[active=true]:bg-sidebar-accent"
              >
                <Link href="/patient-checkup" data-testid="nav-patient-checkup">
                  <ClipboardPlus className="w-4 h-4" />
                  <span>Patient Check-up</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {canManageUsers && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                data-active={location === "/admin/users"}
                className="data-[active=true]:bg-sidebar-accent"
              >
                <Link href="/admin/users" data-testid="nav-admin-users">
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {canViewAuditLogs && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                data-active={location === "/admin/audit"}
                className="data-[active=true]:bg-sidebar-accent"
              >
                <Link href="/admin/audit" data-testid="nav-admin-audit">
                  <Shield className="w-4 h-4" />
                  <span>Audit Logs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              data-active={location === "/settings"}
              className="data-[active=true]:bg-sidebar-accent"
            >
              <Link href="/settings" data-testid="nav-settings">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
