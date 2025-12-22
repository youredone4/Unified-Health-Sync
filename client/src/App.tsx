import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Prenatal from "@/pages/Prenatal";
import ChildHealth from "@/pages/ChildHealth";
import SeniorCare from "@/pages/SeniorCare";
import Inventory from "@/pages/Inventory";
import FacilityMap from "@/pages/FacilityMap";
import Reports from "@/pages/Reports";
import Nutrition from "@/pages/Nutrition";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/prenatal" component={Prenatal} />
      <Route path="/child-health" component={ChildHealth} />
      <Route path="/senior-care" component={SeniorCare} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/map" component={FacilityMap} />
      <Route path="/reports" component={Reports} />
      <Route path="/nutrition" component={Nutrition} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
