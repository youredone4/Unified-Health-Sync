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
} from "lucide-react";

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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-base font-semibold">GeoHealthSync</h1>
            <p className="text-xs text-muted-foreground">Placer Municipality</p>
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
    </Sidebar>
  );
}
