import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Home as HomeIcon,
  HeartHandshake,
  Baby,
  UserCircle,
  Siren,
  Pill,
  Scale,
  Package,
  ClipboardList,
  Shield,
  Stethoscope,
  User,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth, sidebarPermissions, ALL_ROLES } from "@/hooks/use-auth";

interface NavItem {
  title: string;
  // Where clicking the item lands. Each hub uses its "worklist" / default tab
  // as the landing URL so a second click opens the most-used view.
  url: string;
  icon: React.ElementType;
  // Roles derived from sidebarPermissions so sidebar visibility and RoleRoute
  // guards always agree.
  roles: readonly string[];
  // URL prefixes that should show this sidebar item as "active". Anything
  // under /prenatal, /fp, /mother goes to Mothers, etc.
  activePrefixes: readonly string[];
  isBadged?: boolean;
  groupId: "main" | "admin";
}

function rolesFor(url: string): readonly string[] {
  return sidebarPermissions[url] ?? ALL_ROLES;
}

// MGMT_ROLES = any role that can see at least one item in a management hub.
const MGMT = ["SYSTEM_ADMIN", "MHO", "SHA"] as const;

// Flat list of program hubs. Each item is one sidebar click; inside the
// destination page, the ProgramHub header's tab strip exposes the hub's
// sub-views (Worklist / Registry / Dashboard / …).
const NAV_ITEMS: NavItem[] = [
  {
    title: "Home",
    url: "/",
    icon: HomeIcon,
    roles: rolesFor("/"),
    activePrefixes: ["/", "/hotspots", "/calendar", "/messages", "/patient-checkup"],
    groupId: "main",
  },
  {
    title: "Mothers",
    url: "/prenatal",
    icon: HeartHandshake,
    roles: rolesFor("/prenatal"),
    activePrefixes: ["/prenatal", "/mother", "/fp"],
    groupId: "main",
  },
  {
    title: "Children",
    url: "/child",
    icon: Baby,
    roles: rolesFor("/child"),
    activePrefixes: ["/child"],
    groupId: "main",
  },
  {
    title: "Seniors",
    url: "/senior",
    icon: UserCircle,
    roles: rolesFor("/senior"),
    activePrefixes: ["/senior"],
    groupId: "main",
  },
  {
    title: "Disease",
    url: "/disease",
    icon: Siren,
    roles: rolesFor("/disease"),
    activePrefixes: ["/disease"],
    groupId: "main",
  },
  {
    title: "TB DOTS",
    url: "/tb",
    icon: Pill,
    roles: rolesFor("/tb"),
    activePrefixes: ["/tb"],
    groupId: "main",
  },
  {
    title: "Nutrition",
    url: "/nutrition",
    icon: Scale,
    roles: rolesFor("/nutrition"),
    activePrefixes: ["/nutrition"],
    groupId: "main",
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Package,
    roles: rolesFor("/inventory"),
    activePrefixes: ["/inventory"],
    groupId: "main",
  },
  {
    title: "Reports",
    url: "/reports/m1",
    icon: ClipboardList,
    roles: rolesFor("/reports/m1"),
    activePrefixes: ["/reports", "/m1/encode"],
    groupId: "main",
  },
  {
    title: "Admin",
    // Lands on the first tab the current role can access. Route-level RoleRoute
    // picks up the slack — this URL is the most permissive of the three Admin
    // tabs, so any MGMT role can always open Settings.
    url: "/settings",
    icon: Shield,
    roles: MGMT,
    activePrefixes: ["/admin", "/settings"],
    groupId: "admin",
  },
];

function isActiveFor(item: NavItem, location: string): boolean {
  // Exact match on "/" must win — otherwise the Home prefix would steal every
  // click (every URL starts with "/").
  if (item.url === "/" && location !== "/") {
    return item.activePrefixes.some((p) => p !== "/" && (location === p || location.startsWith(`${p}/`)));
  }
  return item.activePrefixes.some(
    (p) => location === p || location.startsWith(`${p}/`),
  );
}

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
  const unreadCount = unreadData?.count ?? 0;

  const lguName = settings?.lguName || "HealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";
  const logoUrl = settings?.logoUrl;
  const showLogo = logoUrl && !logoError;

  const visible = NAV_ITEMS.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const mainItems = visible.filter((i) => i.groupId === "main");
  const adminItems = visible.filter((i) => i.groupId === "admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          {showLogo ? (
            <img
              src={logoUrl}
              alt="LGU Logo"
              className="w-8 h-8 object-contain rounded shrink-0"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Stethoscope className="w-6 h-6 text-primary shrink-0" />
          )}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-base font-semibold truncate" data-testid="text-lgu-name">
              {lguName}
            </h1>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-lgu-subtitle">
              {lguSubtitle}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const active = isActiveFor(item, location);
                const badge = item.isBadged && unreadCount > 0 ? unreadCount : null;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      data-active={active}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                    >
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.url.replace(/\//g, "-") || "home"}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {badge !== null && (
                          <Badge
                            className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs px-1"
                            data-testid="badge-unread-messages"
                          >
                            {badge}
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

        {adminItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => {
                    const active = isActiveFor(item, location);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          data-active={active}
                          className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                        >
                          <Link
                            href={item.url}
                            data-testid={`nav-${item.url.replace(/\//g, "-")}`}
                          >
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="My Account"
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
