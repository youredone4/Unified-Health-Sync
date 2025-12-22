import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import Dashboard from "@/pages/dashboard";
import Hotspots from "@/pages/hotspots";
import CalendarPage from "@/pages/calendar";
import PrenatalWorklist from "@/pages/prenatal-worklist";
import PrenatalDashboard from "@/pages/prenatal-dashboard";
import MotherRegistry from "@/pages/mother-registry";
import MotherProfile from "@/pages/mother-profile";
import ChildWorklist from "@/pages/child-worklist";
import ChildDashboard from "@/pages/child-dashboard";
import ChildRegistry from "@/pages/child-registry";
import ChildProfile from "@/pages/child-profile";
import NutritionWorklist from "@/pages/nutrition-worklist";
import GrowthMonitoring from "@/pages/growth-monitoring";
import NutritionDashboard from "@/pages/nutrition-dashboard";
import SeniorWorklist from "@/pages/senior-worklist";
import SeniorDashboard from "@/pages/senior-dashboard";
import SeniorRegistry from "@/pages/senior-registry";
import SeniorProfile from "@/pages/senior-profile";
import InventoryPage from "@/pages/inventory";
import StockoutsPage from "@/pages/stockouts";
import ReportsPage from "@/pages/reports";
import AIReporting from "@/pages/ai-reporting";
import MapPage from "@/pages/map";
import DiseaseWorklist from "@/pages/disease-worklist";
import DiseaseProfile from "@/pages/disease-profile";
import DiseaseRegistry from "@/pages/disease-registry";
import DiseaseMap from "@/pages/disease-map";
import TBWorklist from "@/pages/tb-worklist";
import TBProfile from "@/pages/tb-profile";
import TBRegistry from "@/pages/tb-registry";
import NotificationDrawer from "@/components/notification-drawer";
import SmsOutbox from "@/components/sms-outbox";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/hotspots" component={Hotspots} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/prenatal" component={PrenatalWorklist} />
      <Route path="/prenatal/dashboard" component={PrenatalDashboard} />
      <Route path="/prenatal/registry" component={MotherRegistry} />
      <Route path="/mother/:id" component={MotherProfile} />
      <Route path="/child" component={ChildWorklist} />
      <Route path="/child/dashboard" component={ChildDashboard} />
      <Route path="/child/registry" component={ChildRegistry} />
      <Route path="/child/:id" component={ChildProfile} />
      <Route path="/nutrition" component={NutritionWorklist} />
      <Route path="/nutrition/growth" component={GrowthMonitoring} />
      <Route path="/nutrition/dashboard" component={NutritionDashboard} />
      <Route path="/senior" component={SeniorWorklist} />
      <Route path="/senior/dashboard" component={SeniorDashboard} />
      <Route path="/senior/registry" component={SeniorRegistry} />
      <Route path="/senior/:id" component={SeniorProfile} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/inventory/stockouts" component={StockoutsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/ai" component={AIReporting} />
      <Route path="/map" component={MapPage} />
      <Route path="/disease" component={DiseaseWorklist} />
      <Route path="/disease/registry" component={DiseaseRegistry} />
      <Route path="/disease/map" component={DiseaseMap} />
      <Route path="/disease/:id" component={DiseaseProfile} />
      <Route path="/tb" component={TBWorklist} />
      <Route path="/tb/registry" component={TBRegistry} />
      <Route path="/tb/:id" component={TBProfile} />
      <Route>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [smsOutboxOpen, setSmsOutboxOpen] = useState(false);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1">
              <header className="flex items-center justify-between gap-2 p-3 border-b border-border sticky top-0 z-50 bg-background">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <span className="text-sm text-muted-foreground">December 22, 2025</span>
                </div>
                <div className="flex items-center gap-2">
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
    </QueryClientProvider>
  );
}

export default App;
