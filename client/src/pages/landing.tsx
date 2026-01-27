import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope, Shield, Users, BarChart3, MapPin, Calendar } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-8 h-8 text-primary" />
            <span className="font-bold text-xl">GeoHealthSync</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-24">
        <section className="py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Barangay Health Information
            <br />
            <span className="text-primary">& Analytics System</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            A comprehensive health management platform designed for local government units. 
            Track prenatal care, child immunizations, senior health, disease surveillance, 
            and medical inventory across your municipality.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Demo system for Municipal Health Offices
          </p>
        </section>

        <section className="py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <Users className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Patient Management</h3>
                <p className="text-muted-foreground">
                  Track prenatal mothers, children, and seniors across all barangays 
                  with comprehensive health records.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <Calendar className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Worklist-First Design</h3>
                <p className="text-muted-foreground">
                  See overdue and due-soon items at a glance. Prioritize follow-ups 
                  with clear status indicators.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <BarChart3 className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Analytics Dashboard</h3>
                <p className="text-muted-foreground">
                  Monitor health trends, identify hotspots, and generate 
                  government-compliant reports.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <MapPin className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Geographic Mapping</h3>
                <p className="text-muted-foreground">
                  Visualize patient locations and health facilities on interactive 
                  maps for better coverage planning.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <Shield className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Role-Based Access</h3>
                <p className="text-muted-foreground">
                  Secure access control with roles for Admin, MHO, SHA, and 
                  Team Leaders with barangay scoping.
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <Stethoscope className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Disease Surveillance</h3>
                <p className="text-muted-foreground">
                  Track communicable diseases and TB DOTS patients with 
                  outbreak detection and alerts.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">
            Sign in with your Replit account to access the demo system.
          </p>
          <Button size="lg" asChild data-testid="button-signin-footer">
            <a href="/api/login">Sign In to Continue</a>
          </Button>
        </section>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>GeoHealthSync - Barangay Health Information & Analytics System</p>
          <p className="mt-1">Demo Application</p>
        </div>
      </footer>
    </div>
  );
}
