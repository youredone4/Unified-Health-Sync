import { useEffect, useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart3,
  ClipboardList,
  Package,
  ClipboardPlus,
  Calendar,
  MessageCircle,
  Shield,
  Stethoscope,
  User,
  Users,
  ChevronRight,
  // Patients children
  HeartHandshake,
  Baby,
  UserCircle,
  Siren,
  Pill,
  // Primary
  Sparkles,
  Scale,
  Snowflake,
  GraduationCap,
  Smile,
  HeartPulse,
  ShieldAlert,
  Skull,
  Droplet,
  UsersRound,
  ArrowRightCircle,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth, sidebarPermissions, ALL_ROLES } from "@/hooks/use-auth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: readonly string[];
  activePrefixes: readonly string[];
  isBadged?: boolean;
  tier: "main" | "decision" | "util" | "admin";
}

function rolesFor(url: string): readonly string[] {
  return sidebarPermissions[url] ?? ALL_ROLES;
}

const MGMT = ["SYSTEM_ADMIN", "MHO", "SHA"] as const;

// Children of the collapsible "Daily Operations" group — modules a TL
// touches as part of routine BHS work (vaccine session, NCD clinic, etc).
const DAILY_OPS_CHILDREN: NavItem[] = [
  {
    title: "Cold-chain",
    url: "/cold-chain",
    icon: Snowflake,
    roles: rolesFor("/cold-chain"),
    activePrefixes: ["/cold-chain"],
    tier: "util",
  },
  {
    title: "NCD Screenings",
    url: "/ncd-screenings",
    icon: HeartPulse,
    roles: rolesFor("/ncd-screenings"),
    activePrefixes: ["/ncd-screenings"],
    tier: "util",
  },
  {
    title: "Oral Health",
    url: "/oral-health",
    icon: Smile,
    roles: rolesFor("/oral-health"),
    activePrefixes: ["/oral-health"],
    tier: "util",
  },
  {
    title: "School Immunization",
    url: "/school-immunizations",
    icon: GraduationCap,
    roles: rolesFor("/school-immunizations"),
    activePrefixes: ["/school-immunizations"],
    tier: "util",
  },
];

// Children of the collapsible "Registries & Surveillance" group — periodic
// modules driven by registry maintenance and surveillance reporting.
const SURVEILLANCE_CHILDREN: NavItem[] = [
  {
    title: "Disease Programs",
    url: "/disease-surveillance",
    icon: ShieldAlert,
    roles: rolesFor("/disease-surveillance"),
    activePrefixes: ["/disease-surveillance"],
    tier: "util",
  },
  {
    title: "Mortality Registry",
    url: "/mortality",
    icon: Skull,
    roles: rolesFor("/mortality"),
    activePrefixes: ["/mortality"],
    tier: "util",
  },
  {
    title: "Household Water",
    url: "/household-water",
    icon: Droplet,
    roles: rolesFor("/household-water"),
    activePrefixes: ["/household-water"],
    tier: "util",
  },
];

// Children of the collapsible Patients group.
const PATIENT_CHILDREN: NavItem[] = [
  {
    title: "Mothers",
    url: "/prenatal",
    icon: HeartHandshake,
    roles: rolesFor("/prenatal"),
    activePrefixes: ["/prenatal", "/mother", "/fp"],
    tier: "main",
  },
  {
    title: "Children",
    url: "/child",
    icon: Baby,
    roles: rolesFor("/child"),
    activePrefixes: ["/child"],
    tier: "main",
  },
  {
    title: "TB DOTS",
    url: "/tb",
    icon: Pill,
    roles: rolesFor("/tb"),
    activePrefixes: ["/tb"],
    tier: "main",
  },
  {
    title: "Seniors",
    url: "/senior",
    icon: UserCircle,
    roles: rolesFor("/senior"),
    activePrefixes: ["/senior"],
    tier: "main",
  },
  {
    title: "Disease Cases",
    url: "/disease",
    icon: Siren,
    roles: rolesFor("/disease"),
    activePrefixes: ["/disease"],
    tier: "main",
  },
];

// Flat top-level items outside the Patients group.
const NAV_ITEMS: NavItem[] = [
  {
    title: "Today",
    url: "/today",
    icon: Sparkles,
    roles: rolesFor("/today"),
    activePrefixes: ["/today"],
    tier: "main",
  },
  // Calendar sits immediately under Today since users frequently glance at
  // it alongside the daily worklist (visit schedules, appointments, OTPs).
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    roles: rolesFor("/calendar"),
    activePrefixes: ["/calendar"],
    tier: "main",
  },
  // Patients group handled separately (collapsible)
  {
    title: "Nutrition",
    url: "/nutrition",
    icon: Scale,
    roles: rolesFor("/nutrition"),
    activePrefixes: ["/nutrition"],
    tier: "main",
  },
  {
    title: "Dashboards",
    url: "/dashboards",
    icon: BarChart3,
    roles: rolesFor("/dashboards"),
    activePrefixes: ["/dashboards", "/"],
    tier: "decision",
  },
  {
    title: "Reports",
    url: "/reports",
    icon: ClipboardList,
    roles: rolesFor("/reports"),
    activePrefixes: ["/reports"],
    tier: "decision",
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Package,
    roles: rolesFor("/inventory"),
    activePrefixes: ["/inventory"],
    tier: "decision",
  },
  {
    title: "Workforce",
    url: "/workforce",
    icon: UsersRound,
    roles: rolesFor("/workforce"),
    activePrefixes: ["/workforce"],
    tier: "decision",
  },
  {
    title: "Referrals",
    url: "/referrals",
    icon: ArrowRightCircle,
    roles: rolesFor("/referrals"),
    activePrefixes: ["/referrals"],
    tier: "decision",
  },
  // Daily Operations and Registries & Surveillance groups are rendered as
  // collapsible submenus in the util tier — see their CHILDREN arrays above.
  {
    title: "Clinic Check-up",
    url: "/patient-checkup",
    icon: ClipboardPlus,
    roles: rolesFor("/patient-checkup"),
    activePrefixes: ["/patient-checkup"],
    tier: "util",
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircle,
    roles: rolesFor("/messages"),
    activePrefixes: ["/messages"],
    isBadged: true,
    tier: "util",
  },
  {
    title: "Admin",
    url: "/settings",
    icon: Shield,
    roles: MGMT,
    activePrefixes: ["/admin", "/settings"],
    tier: "admin",
  },
];

function isActiveFor(item: NavItem, location: string): boolean {
  return item.activePrefixes.some(
    (p) => (p === "/" ? location === "/" : location === p || location.startsWith(`${p}/`)),
  );
}

const PATIENTS_OPEN_KEY = "sidebar.patients.open";
const DAILY_OPS_OPEN_KEY = "sidebar.dailyOps.open";
const SURVEILLANCE_OPEN_KEY = "sidebar.surveillance.open";

export function AppSidebar() {
  const [location] = useLocation();
  const { settings } = useTheme();
  const { role, isAuthenticated } = useAuth();
  const [logoError, setLogoError] = useState(false);

  // Persisted expand/collapse state for collapsible groups.
  const [patientsOpen, setPatientsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(PATIENTS_OPEN_KEY);
    return raw === null ? true : raw === "1";
  });
  useEffect(() => {
    window.localStorage.setItem(PATIENTS_OPEN_KEY, patientsOpen ? "1" : "0");
  }, [patientsOpen]);

  const [dailyOpsOpen, setDailyOpsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(DAILY_OPS_OPEN_KEY);
    return raw === null ? true : raw === "1";
  });
  useEffect(() => {
    window.localStorage.setItem(DAILY_OPS_OPEN_KEY, dailyOpsOpen ? "1" : "0");
  }, [dailyOpsOpen]);

  const [surveillanceOpen, setSurveillanceOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(SURVEILLANCE_OPEN_KEY);
    return raw === null ? false : raw === "1";
  });
  useEffect(() => {
    window.localStorage.setItem(SURVEILLANCE_OPEN_KEY, surveillanceOpen ? "1" : "0");
  }, [surveillanceOpen]);

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

  const visibleTop = NAV_ITEMS.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const visiblePatientChildren = PATIENT_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const visibleDailyOps = DAILY_OPS_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const visibleSurveillance = SURVEILLANCE_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );

  const byTier = (t: NavItem["tier"]) => visibleTop.filter((i) => i.tier === t);
  const mainTop = byTier("main");
  const decision = byTier("decision");
  const util = byTier("util");
  const admin = byTier("admin");

  const patientsGroupActive = PATIENT_CHILDREN.some((c) => isActiveFor(c, location));
  const dailyOpsActive = DAILY_OPS_CHILDREN.some((c) => isActiveFor(c, location));
  const surveillanceActive = SURVEILLANCE_CHILDREN.some((c) => isActiveFor(c, location));

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
        {/* Daily work tier: Today + Patients group + Nutrition */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainTop
                .filter((i) => i.url === "/today" || i.url === "/calendar")
                .map((item) => (
                  <SidebarItemRow key={item.title} item={item} location={location} unreadCount={unreadCount} />
                ))}

              {/* Patients collapsible group */}
              {visiblePatientChildren.length > 0 && (
                <Collapsible
                  open={patientsOpen}
                  onOpenChange={setPatientsOpen}
                  className="group/patients"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Patients"
                        data-active={patientsGroupActive}
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                        data-testid="nav-patients-toggle"
                      >
                        <Users className="w-4 h-4" />
                        <span>Patients</span>
                        <ChevronRight className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/patients:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visiblePatientChildren.map((item) => {
                          const active = isActiveFor(item, location);
                          return (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton
                                asChild
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
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {mainTop
                .filter((i) => i.url !== "/today" && i.url !== "/calendar")
                .map((item) => (
                  <SidebarItemRow key={item.title} item={item} location={location} unreadCount={unreadCount} />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Decision-making tier */}
        {decision.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {decision.map((item) => (
                    <SidebarItemRow key={item.title} item={item} location={location} unreadCount={unreadCount} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Utilities tier — flat items + two collapsible groups */}
        {(util.length > 0 || visibleDailyOps.length > 0 || visibleSurveillance.length > 0) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Daily Operations group */}
                  {visibleDailyOps.length > 0 && (
                    <Collapsible
                      open={dailyOpsOpen}
                      onOpenChange={setDailyOpsOpen}
                      className="group/dailyops"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Daily Operations"
                            data-active={dailyOpsActive}
                            className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                            data-testid="nav-daily-ops-toggle"
                          >
                            <ClipboardPlus className="w-4 h-4" />
                            <span>Daily Operations</span>
                            <ChevronRight className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/dailyops:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {visibleDailyOps.map((item) => {
                              const active = isActiveFor(item, location);
                              return (
                                <SidebarMenuSubItem key={item.title}>
                                  <SidebarMenuSubButton
                                    asChild
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
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}

                  {/* Registries & Surveillance group */}
                  {visibleSurveillance.length > 0 && (
                    <Collapsible
                      open={surveillanceOpen}
                      onOpenChange={setSurveillanceOpen}
                      className="group/surveillance"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Registries & Surveillance"
                            data-active={surveillanceActive}
                            className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                            data-testid="nav-surveillance-toggle"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            <span>Registries &amp; Surveillance</span>
                            <ChevronRight className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/surveillance:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {visibleSurveillance.map((item) => {
                              const active = isActiveFor(item, location);
                              return (
                                <SidebarMenuSubItem key={item.title}>
                                  <SidebarMenuSubButton
                                    asChild
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
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}

                  {/* Remaining flat util items (Calendar, Messages, Clinic Check-up) */}
                  {util.map((item) => (
                    <SidebarItemRow key={item.title} item={item} location={location} unreadCount={unreadCount} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Admin tier */}
        {admin.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {admin.map((item) => (
                    <SidebarItemRow key={item.title} item={item} location={location} unreadCount={unreadCount} />
                  ))}
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

function SidebarItemRow({
  item,
  location,
  unreadCount,
}: {
  item: NavItem;
  location: string;
  unreadCount: number;
}) {
  const active = isActiveFor(item, location);
  const badge = item.isBadged && unreadCount > 0 ? unreadCount : null;
  return (
    <SidebarMenuItem>
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
}
