import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaSetup } from "@/components/mfa-setup";
import { useAuth } from "@/hooks/use-auth";

/**
 * Shown instead of the app when the signed-in account's role requires
 * two-step sign-in and it has not been set up yet. The server refuses
 * everything else until it is, so there is nothing to navigate to.
 */
export default function MfaSetupRequired() {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Set up two-step sign-in</CardTitle>
          <CardDescription>
            Signed in as <strong>{user?.username}</strong>. Your role can see and change records for the whole
            municipality, so it must be protected by a second step. This takes about two minutes and you need
            your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MfaSetup onDone={() => { window.location.href = "/"; }} />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout-instead"
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
