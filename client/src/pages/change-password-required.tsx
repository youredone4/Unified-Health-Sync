import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { checkPassword, PASSWORD_RULES_SUMMARY } from "@shared/password-policy";

/**
 * Shown instead of the app when the signed-in account must replace its
 * password: a new account, a password an administrator just reset, or an
 * old password that no longer meets the rules. The server refuses every
 * other request until this is done, so there is nothing to navigate to.
 */
export default function ChangePasswordRequired() {
  const { user, logout, isLoggingOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not change password. Please try again.");
      return data;
    },
    onSuccess: () => {
      // Full reload so every cached query starts fresh under the new state.
      window.location.href = "/";
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword) return setError("Enter your current (temporary) password.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    if (newPassword === currentPassword) return setError("New password must be different from the current one.");
    const check = checkPassword(newPassword, user ?? {});
    if (!check.ok) return setError(check.message ?? "Password does not meet the requirements.");
    mutation.mutate();
  };

  const type = show ? "text" : "password";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Set a new password</CardTitle>
          <CardDescription>
            Signed in as <strong>{user?.username}</strong>. Before you continue, replace your current
            password with one only you know.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-md p-3 text-sm bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
                role="alert"
                data-testid="change-password-error"
              >
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type={type}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={mutation.isPending}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type={type}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={mutation.isPending}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">{PASSWORD_RULES_SUMMARY}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type={type}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={mutation.isPending}
                data-testid="input-confirm-password"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-change-password">
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save new password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => logout()}
              disabled={isLoggingOut || mutation.isPending}
              data-testid="button-logout-instead"
            >
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
