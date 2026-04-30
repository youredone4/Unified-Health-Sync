import React, { useEffect, useState } from "react";
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
  Inbox,
  AlertOctagon,
  ClipboardCheck,
  Boxes,
  FileText,
  Megaphone,
  ShieldCheck,
  Syringe,
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
  badgeSource?: "messages" | "mgmt-inbox";
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
  },
  {
    title: "NCD Screenings",
    url: "/ncd-screenings",
    icon: HeartPulse,
    roles: rolesFor("/ncd-screenings"),
    activePrefixes: ["/ncd-screenings"],
  },
  {
    title: "Oral Health",
    url: "/oral-health",
    icon: Smile,
    roles: rolesFor("/oral-health"),
    activePrefixes: ["/oral-health"],
  },
  {
    title: "School Immunization",
    url: "/school-immunizations",
    icon: GraduationCap,
    roles: rolesFor("/school-immunizations"),
    activePrefixes: ["/school-immunizations"],
  },
];

// Children of the collapsible "Registries & Surveillance" group — periodic
// modules driven by registry maintenance and surveillance reporting.
//
// Group 1 of the architecture review consolidated Disease Programs + PIDSR
// + Disease Map under the Disease Surveillance hub (top-level item below).
// They no longer have standalone children here; users reach them via tabs
// inside the hub.
const SURVEILLANCE_CHILDREN: NavItem[] = [
  {
    // Group 2 hub: collapses Mortality Registry + Death Reviews into a
    // single sidebar entry. Tabs inside the hub are role-aware
    // (TLs see Registry only; MGMT sees both). activePrefixes covers the
    // legacy URLs so the entry stays highlighted on old bookmarks.
    title: "Mortality & Death Surveillance",
    url: "/mortality-hub",
    icon: Skull,
    roles: rolesFor("/mortality-hub"),
    activePrefixes: ["/mortality-hub", "/mortality", "/death-events"],
  },
  {
    title: "Household Water",
    url: "/household-water",
    icon: Droplet,
    roles: rolesFor("/household-water"),
    activePrefixes: ["/household-water"],
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
  },
  {
    title: "Children",
    url: "/child",
    icon: Baby,
    roles: rolesFor("/child"),
    activePrefixes: ["/child"],
  },
  {
    title: "TB DOTS",
    url: "/tb",
    icon: Pill,
    roles: rolesFor("/tb"),
    activePrefixes: ["/tb"],
  },
  {
    title: "Seniors",
    url: "/senior",
    icon: UserCircle,
    roles: rolesFor("/senior"),
    activePrefixes: ["/senior"],
  },
  {
    // Group 1 hub: consolidates Disease Cases + Vertical Programs (filariasis,
    // rabies, schisto, STH, leprosy) + PIDSR + Disease Map. Each tab keeps
    // its own underlying URL; the hub shell is supplied by DiseaseHub in
    // App.tsx. activePrefixes cover all four so the sidebar entry stays
    // highlighted on every tab and old bookmarks resolve.
    title: "Disease Surveillance",
    url: "/disease",
    icon: Siren,
    roles: rolesFor("/disease"),
    activePrefixes: ["/disease", "/disease-surveillance", "/pidsr"],
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
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    roles: rolesFor("/calendar"),
    activePrefixes: ["/calendar"],
  },
  {
    title: "Nutrition",
    url: "/nutrition",
    icon: Scale,
    roles: rolesFor("/nutrition"),
    activePrefixes: ["/nutrition"],
  },
  {
    title: "Dashboards",
    url: "/dashboards",
    icon: BarChart3,
    roles: rolesFor("/dashboards"),
    activePrefixes: ["/dashboards", "/"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: ClipboardList,
    roles: rolesFor("/reports"),
    activePrefixes: ["/reports"],
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Package,
    roles: rolesFor("/inventory"),
    activePrefixes: ["/inventory"],
  },
  {
    title: "Workforce",
    url: "/workforce",
    icon: UsersRound,
    roles: rolesFor("/workforce"),
    activePrefixes: ["/workforce"],
  },
  {
    title: "Referrals",
    url: "/referrals",
    icon: ArrowRightCircle,
    roles: rolesFor("/referrals"),
    activePrefixes: ["/referrals"],
  },
  {
    title: "MGMT Inbox",
    url: "/mgmt-inbox",
    icon: Inbox,
    roles: rolesFor("/mgmt-inbox"),
    activePrefixes: ["/mgmt-inbox"],
    isBadged: true,
    badgeSource: "mgmt-inbox",
  },
  {
    title: "Outbreaks",
    url: "/outbreaks",
    icon: AlertOctagon,
    roles: rolesFor("/outbreaks"),
    activePrefixes: ["/outbreaks"],
  },
  {
    title: "Triage / Walk-in",
    url: "/walk-in",
    icon: ClipboardCheck,
    roles: rolesFor("/walk-in"),
    activePrefixes: ["/walk-in", "/patient-checkup"],
  },
  {
    title: "Restock Requests",
    url: "/restock-requests",
    icon: Boxes,
    roles: rolesFor("/restock-requests"),
    activePrefixes: ["/restock-requests"],
  },
  {
    title: "Certificates",
    url: "/certificates",
    icon: FileText,
    roles: rolesFor("/certificates"),
    activePrefixes: ["/certificates"],
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Megaphone,
    roles: rolesFor("/campaigns"),
    activePrefixes: ["/campaigns"],
  },
  {
    title: "Konsulta",
    url: "/konsulta",
    icon: ShieldCheck,
    roles: rolesFor("/konsulta"),
    activePrefixes: ["/konsulta"],
  },
  {
    title: "AEFI",
    url: "/aefi",
    icon: Syringe,
    roles: rolesFor("/aefi"),
    activePrefixes: ["/aefi"],
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircle,
    roles: rolesFor("/messages"),
    activePrefixes: ["/messages"],
    isBadged: true,
    badgeSource: "messages",
  },
  {
    title: "Admin",
    url: "/settings",
    icon: Shield,
    roles: MGMT,
    activePrefixes: ["/admin", "/settings"],
  },
];

// ─── Role-driven sidebar layout ─────────────────────────────────────────────
// Each role gets a sequence of sections; each section a sequence of "units"
// (regular item or special collapsible group). Sections are separated by
// SidebarSeparator. Items missing for the role (RBAC) are filtered out so a
// section may collapse to fewer rows but never gains items not in NAV_ITEMS.
type GroupKey = "patients" | "daily-ops" | "surveillance";
type SidebarUnit = { kind: "item"; url: string } | { kind: "group"; key: GroupKey };
type SidebarLayout = SidebarUnit[][];

// TL: daily-work-first. Today + the capture screens bubble up; consolidated
// views, registries, and reporting live below.
const TL_LAYOUT: SidebarLayout = [
  // Action — what they're working on right now
  [
    { kind: "item",  url: "/today" },
    { kind: "item",  url: "/walk-in" },
    { kind: "group", key: "patients" },
  ],
  // Capture — registries and clinical entry
  [
    { kind: "group", key: "daily-ops" },
    { kind: "group", key: "surveillance" },
    { kind: "item",  url: "/referrals" },
    { kind: "item",  url: "/aefi" },
    { kind: "item",  url: "/certificates" },
    { kind: "item",  url: "/campaigns" },
    { kind: "item",  url: "/konsulta" },
  ],
  // Stock — TL view of inventory + restock requests they file
  [
    { kind: "item", url: "/inventory" },
    { kind: "item", url: "/restock-requests" },
  ],
  // Schedule + analytics + utilities
  [
    { kind: "item", url: "/calendar" },
    { kind: "item", url: "/nutrition" },
    { kind: "item", url: "/reports" },
    { kind: "item", url: "/workforce" },
    { kind: "item", url: "/messages" },
  ],
];

// MGMT (MHO / SHA / Admin): decision-first. Inbox + Dashboards on top so the
// first thing they see is what needs their attention.
const MGMT_LAYOUT: SidebarLayout = [
  // Action / decision — what needs their attention now
  [
    { kind: "item", url: "/mgmt-inbox" },
    { kind: "item", url: "/dashboards" },
    { kind: "item", url: "/outbreaks" },
    { kind: "item", url: "/mortality-hub" },
    { kind: "item", url: "/aefi" },
    { kind: "item", url: "/referrals" },
    // The MD's "Awaiting MD review" inbox lives on this page — surfaces
    // EMERGENT/URGENT and BHS-escalated encounters that still need the MD
    // to sign off. Sits next to /referrals because both are BHS→RHU
    // handoff queues.
    { kind: "item", url: "/walk-in" },
    { kind: "item", url: "/restock-requests" },
    { kind: "item", url: "/reports" },
  ],
  // Operational view — consolidated data they monitor
  [
    { kind: "item",  url: "/today" },
    { kind: "group", key: "patients" },
    { kind: "item",  url: "/inventory" },
    { kind: "item",  url: "/workforce" },
  ],
  // Capture screens (read-only for MGMT) + utilities
  [
    { kind: "group", key: "daily-ops" },
    { kind: "group", key: "surveillance" },
    { kind: "item",  url: "/certificates" },
    { kind: "item",  url: "/campaigns" },
    { kind: "item",  url: "/konsulta" },
    { kind: "item",  url: "/calendar" },
    { kind: "item",  url: "/nutrition" },
    { kind: "item",  url: "/messages" },
  ],
  // Admin — system administration
  [
    { kind: "item", url: "/settings" },
  ],
];

function getLayoutForRole(role: string | undefined): SidebarLayout {
  if (role === "TL") return TL_LAYOUT;
  return MGMT_LAYOUT;
}

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
  const { role, isAuthenticated, isMHO, isSHA, isAdmin } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;
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

  // MGMT inbox count — drives the live badge on the "MGMT Inbox" sidebar
  // entry. Only fetched for MGMT roles since the endpoint 403s for TLs.
  const { data: inboxData } = useQuery<{ counts: { total: number } }>({
    queryKey: ["/api/mgmt/inbox"],
    refetchInterval: 60_000,
    enabled: isAuthenticated && isMgmt,
  });
  const inboxCount = inboxData?.counts?.total ?? 0;

  const lguName = settings?.lguName || "HealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";
  const logoUrl = settings?.logoUrl;
  const showLogo = logoUrl && !logoError;

  const visiblePatientChildren = PATIENT_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const visibleDailyOps = DAILY_OPS_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );
  const visibleSurveillance = SURVEILLANCE_CHILDREN.filter((item) =>
    role ? (item.roles as string[]).includes(role) : false,
  );


  const patientsGroupActive = PATIENT_CHILDREN.some((c) => isActiveFor(c, location));
  const dailyOpsActive = DAILY_OPS_CHILDREN.some((c) => isActiveFor(c, location));
  const surveillanceActive = SURVEILLANCE_CHILDREN.some((c) => isActiveFor(c, location));

  // Role-driven sidebar order: TL gets daily-work-first, MGMT gets
  // decision-first. See {TL,MGMT}_LAYOUT for the canonical sequences.
  const layout = getLayoutForRole(role);

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
        {layout.map((section, sectionIdx) => {
          // Resolve each unit in this section to a renderable element.
          // Items missing for the role (RBAC) or empty groups are skipped;
          // a section with zero rendered units collapses entirely.
          const rendered: React.ReactNode[] = [];
          for (const unit of section) {
            if (unit.kind === "item") {
              const item = NAV_ITEMS.find((n) => n.url === unit.url);
              if (!item) continue;
              if (role && !(item.roles as string[]).includes(role)) continue;
              rendered.push(
                <SidebarItemRow
                  key={item.title}
                  item={item}
                  location={location}
                  unreadCount={unreadCount}
                  inboxCount={inboxCount}
                />,
              );
              continue;
            }
            if (unit.key === "patients" && visiblePatientChildren.length > 0) {
              rendered.push(
                <CollapsibleGroup
                  key="patients"
                  groupClassName="group/patients"
                  triggerClassName="group-data-[state=open]/patients:rotate-90"
                  testId="nav-patients-toggle"
                  icon={Users}
                  label="Patients"
                  open={patientsOpen}
                  onOpenChange={setPatientsOpen}
                  active={patientsGroupActive}
                  items={visiblePatientChildren}
                  location={location}
                />,
              );
              continue;
            }
            if (unit.key === "daily-ops" && visibleDailyOps.length > 0) {
              rendered.push(
                <CollapsibleGroup
                  key="daily-ops"
                  groupClassName="group/dailyops"
                  triggerClassName="group-data-[state=open]/dailyops:rotate-90"
                  testId="nav-daily-ops-toggle"
                  icon={ClipboardPlus}
                  label="Daily Operations"
                  open={dailyOpsOpen}
                  onOpenChange={setDailyOpsOpen}
                  active={dailyOpsActive}
                  items={visibleDailyOps}
                  location={location}
                />,
              );
              continue;
            }
            if (unit.key === "surveillance" && visibleSurveillance.length > 0) {
              rendered.push(
                <CollapsibleGroup
                  key="surveillance"
                  groupClassName="group/surveillance"
                  triggerClassName="group-data-[state=open]/surveillance:rotate-90"
                  testId="nav-surveillance-toggle"
                  icon={ShieldAlert}
                  label="Registries & Surveillance"
                  open={surveillanceOpen}
                  onOpenChange={setSurveillanceOpen}
                  active={surveillanceActive}
                  items={visibleSurveillance}
                  location={location}
                />,
              );
              continue;
            }
          }
          if (rendered.length === 0) return null;
          return (
            <React.Fragment key={`section-${sectionIdx}`}>
              {sectionIdx > 0 && <SidebarSeparator />}
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>{rendered}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          );
        })}
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
  inboxCount,
}: {
  item: NavItem;
  location: string;
  unreadCount: number;
  inboxCount: number;
}) {
  const active = isActiveFor(item, location);
  // Resolve which counter feeds this row's badge based on its badgeSource.
  // Default ("messages" or undefined) preserves the legacy behaviour for
  // any row that opted in via isBadged before badgeSource existed.
  const sourceCount =
    item.badgeSource === "mgmt-inbox" ? inboxCount : unreadCount;
  const badge = item.isBadged && sourceCount > 0 ? sourceCount : null;
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

function CollapsibleGroup({
  groupClassName,
  triggerClassName,
  testId,
  icon: Icon,
  label,
  open,
  onOpenChange,
  active,
  items,
  location,
}: {
  groupClassName: string;
  triggerClassName: string;
  testId: string;
  icon: React.ElementType;
  label: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  active: boolean;
  items: NavItem[];
  location: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={groupClassName}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={label}
            data-active={active}
            className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
            data-testid={testId}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${triggerClassName}`} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => {
              const isActive = isActiveFor(item, location);
              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    data-active={isActive}
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
  );
}
