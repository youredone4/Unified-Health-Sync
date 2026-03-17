import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { useAuth, sidebarPermissions } from "@/hooks/use-auth";

import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Hotspots from "@/pages/hotspots";
import CalendarPage from "@/pages/calendar";
import PrenatalWorklist from "@/pages/prenatal-worklist";
import PrenatalDashboard from "@/pages/prenatal-dashboard";
import MotherRegistry from "@/pages/mother-registry";
import MotherProfile from "@/pages/mother-profile";
import MotherForm from "@/pages/mother-form";
import ChildWorklist from "@/pages/child-worklist";
import ChildDashboard from "@/pages/child-dashboard";
import ChildRegistry from "@/pages/child-registry";
import ChildProfile from "@/pages/child-profile";
import ChildForm from "@/pages/child-form";
import NutritionWorklist from "@/pages/nutrition-worklist";
import GrowthMonitoring from "@/pages/growth-monitoring";
import NutritionDashboard from "@/pages/nutrition-dashboard";
import SeniorWorklist from "@/pages/senior-worklist";
import SeniorDashboard from "@/pages/senior-dashboard";
import SeniorRegistry from "@/pages/senior-registry";
import SeniorProfile from "@/pages/senior-profile";
import SeniorForm from "@/pages/senior-form";
import InventoryPage from "@/pages/inventory";
import StockoutsPage from "@/pages/stockouts";
import ReportsPage from "@/pages/reports";
import AIReporting from "@/pages/ai-reporting";
import DiseaseWorklist from "@/pages/disease-worklist";
import DiseaseProfile from "@/pages/disease-profile";
import DiseaseRegistry from "@/pages/disease-registry";
import DiseaseMap from "@/pages/disease-map";
import TBWorklist from "@/pages/tb-worklist";
import TBProfile from "@/pages/tb-profile";
import TBRegistry from "@/pages/tb-registry";
import TBForm from "@/pages/tb-form";
import DiseaseForm from "@/pages/disease-form";
import InventoryForm from "@/pages/inventory-form";
import SettingsPage from "@/pages/settings";
import UserManagement from "@/pages/admin/user-management";
import AuditLogs from "@/pages/admin/audit-logs";
import PatientCheckupPage from "@/pages/patient-checkup";
import M1ReportPage from "@/pages/m1-report";
import NotificationDrawer from "@/components/notification-drawer";
import SmsOutbox from "@/components/sms-outbox";
import MessagesPage from "@/pages/messages";

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  MHO: "MHO",
  SHA: "SHA",
  TL: "Team Leader (Barangay Nurse)",
};

// Demo date per project requirements
const DEMO_DATE = "December 22, 2025";

// Shared "Access Denied" UI
function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Access Denied</p>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    </div>
  );
}

// Generic role-based route guard.
// allowedRoles should come from sidebarPermissions[path] so sidebar visibility and
// route access enforcement share the same policy — single source of truth.
function RoleRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles: readonly string[] }) {
  const { role } = useAuth();
  if (!role || !allowedRoles.includes(role)) return <AccessDenied />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/prenatal" component={PrenatalWorklist} />
      <Route path="/prenatal/dashboard" component={PrenatalDashboard} />
      <Route path="/prenatal/registry" component={MotherRegistry} />
      <Route path="/mother/new" component={MotherForm} />
      <Route path="/mother/:id/edit" component={MotherForm} />
      <Route path="/mother/:id" component={MotherProfile} />
      <Route path="/child" component={ChildWorklist} />
      <Route path="/child/dashboard" component={ChildDashboard} />
      <Route path="/child/registry" component={ChildRegistry} />
      <Route path="/child/new" component={ChildForm} />
      <Route path="/child/:id/edit" component={ChildForm} />
      <Route path="/child/:id" component={ChildProfile} />
      <Route path="/nutrition" component={NutritionWorklist} />
      <Route path="/nutrition/growth" component={GrowthMonitoring} />
      <Route path="/nutrition/dashboard" component={NutritionDashboard} />
      <Route path="/senior" component={SeniorWorklist} />
      <Route path="/senior/dashboard" component={SeniorDashboard} />
      <Route path="/senior/registry" component={SeniorRegistry} />
      <Route path="/senior/new" component={SeniorForm} />
      <Route path="/senior/:id/edit" component={SeniorForm} />
      <Route path="/senior/:id" component={SeniorProfile} />
      <Route path="/inventory">
        <RoleRoute component={InventoryPage} allowedRoles={sidebarPermissions["/inventory"]} />
      </Route>
      <Route path="/inventory/new">
        <RoleRoute component={InventoryForm} allowedRoles={sidebarPermissions["/inventory"]} />
      </Route>
      <Route path="/inventory/:id/edit">
        <RoleRoute component={InventoryForm} allowedRoles={sidebarPermissions["/inventory"]} />
      </Route>
      <Route path="/inventory/stockouts">
        <RoleRoute component={StockoutsPage} allowedRoles={sidebarPermissions["/inventory/stockouts"]} />
      </Route>
      <Route path="/reports">
        <RoleRoute component={ReportsPage} allowedRoles={sidebarPermissions["/reports"]} />
      </Route>
      <Route path="/reports/ai">
        <RoleRoute component={AIReporting} allowedRoles={sidebarPermissions["/reports/ai"]} />
      </Route>
      <Route path="/reports/m1">
        <RoleRoute component={M1ReportPage} allowedRoles={sidebarPermissions["/reports/m1"]} />
      </Route>
      <Route path="/disease" component={DiseaseWorklist} />
      <Route path="/disease/registry" component={DiseaseRegistry} />
      <Route path="/disease/map">
        <RoleRoute component={DiseaseMap} allowedRoles={sidebarPermissions["/disease/map"]} />
      </Route>
      <Route path="/disease/new" component={DiseaseForm} />
      <Route path="/disease/:id/edit" component={DiseaseForm} />
      <Route path="/disease/:id" component={DiseaseProfile} />
      <Route path="/tb" component={TBWorklist} />
      <Route path="/tb/registry" component={TBRegistry} />
      <Route path="/tb/new" component={TBForm} />
      <Route path="/tb/:id/edit" component={TBForm} />
      <Route path="/tb/:id" component={TBProfile} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/settings">
        <RoleRoute component={SettingsPage} allowedRoles={sidebarPermissions["/settings"]} />
      </Route>
      <Route path="/patient-checkup">
        <RoleRoute component={PatientCheckupPage} allowedRoles={sidebarPermissions["/patient-checkup"]} />
      </Route>
      <Route path="/hotspots">
        <RoleRoute component={Hotspots} allowedRoles={sidebarPermissions["/hotspots"]} />
      </Route>
      <Route path="/admin/users">
        <RoleRoute component={UserManagement} allowedRoles={sidebarPermissions["/admin/users"]} />
      </Route>
      <Route path="/admin/audit">
        <RoleRoute component={AuditLogs} allowedRoles={sidebarPermissions["/admin/audit"]} />
      </Route>
      <Route>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, role, logout, isLoggingOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [smsOutboxOpen, setSmsOutboxOpen] = useState(false);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1">
              <header className="flex items-center justify-between gap-2 p-3 border-b border-border sticky top-0 z-50 bg-background">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <span className="text-sm text-muted-foreground">{DEMO_DATE}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSmsOutboxOpen(true)}
                    data-testid="button-sms-outbox"
                  >
                    SMS Outbox
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNotificationsOpen(true)}
                    data-testid="button-notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:inline max-w-32 truncate">
                          {user?.firstName || user?.email || "User"}
                        </span>
                        {role && (
                          <Badge variant="secondary" className="text-xs hidden md:inline">
                            {roleLabels[role] || role}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span>{user?.firstName} {user?.lastName}</span>
                          <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => logout()}
                        disabled={isLoggingOut}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {isLoggingOut ? "Signing out..." : "Sign Out"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
              <main className="flex-1 overflow-auto p-4">
                <Router />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
        <NotificationDrawer open={notificationsOpen} onOpenChange={setNotificationsOpen} />
        <SmsOutbox open={smsOutboxOpen} onOpenChange={setSmsOutboxOpen} />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage />
        <Toaster />
      </>
    );
  }

  // Show authenticated app
  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
