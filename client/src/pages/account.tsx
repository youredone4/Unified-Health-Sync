import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UserCircle, Lock, Save } from "lucide-react";
import { useGlossaryPreference } from "@/hooks/use-glossary-preference";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  MHO: "Municipal Health Officer",
  SHA: "Senior Health Admin",
  TL: "Team Leader (Barangay Nurse)",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

const profileSchema = z.object({
  firstName: z.string().max(100, "Too long").optional().or(z.literal("")),
  lastName: z.string().max(100, "Too long").optional().or(z.literal("")),
  email: z.union([z.string().email("Enter a valid email address"), z.literal("")]).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
  }, [user?.id]);

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileValues) => {
      const res = await apiRequest("PUT", "/api/auth/me/profile", {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordValues) => {
      const res = await apiRequest("PUT", "/api/auth/me/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      const msg = error.message || "Failed to change password";
      if (msg.toLowerCase().includes("incorrect")) {
        passwordForm.setError("currentPassword", { message: "Current password is incorrect" });
      } else {
        toast({ title: "Failed to change password", description: msg, variant: "destructive" });
      }
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-account-title">
          <UserCircle className="w-6 h-6 text-primary" />
          My Account
        </h1>
        <p className="text-muted-foreground">Manage your profile information and password</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your name and email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Read-only system fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">User ID</p>
              <p className="text-sm font-mono bg-muted rounded px-2 py-1 truncate" data-testid="text-user-id">
                {user?.id || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Username</p>
              <Input
                value={user?.username || ""}
                disabled
                className="bg-muted cursor-not-allowed h-8 text-sm"
                data-testid="input-username-readonly"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <div className="flex items-center h-8">
                <Badge variant="secondary" className="text-xs" data-testid="text-user-role">
                  {roleLabels[user?.role || ""] || user?.role || "—"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Account Status</p>
              <div className="flex items-center h-8">
                <Badge
                  variant={user?.status === "ACTIVE" ? "default" : "outline"}
                  className="text-xs"
                  data-testid="text-user-status"
                >
                  {statusLabels[user?.status || ""] || user?.status || "—"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Editable profile fields */}
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your first name"
                          {...field}
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your last name"
                          {...field}
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={profileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {profileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Enter your current password, then choose a new one (minimum 8 characters)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Your current password"
                        {...field}
                        data-testid="input-current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="At least 8 characters"
                        {...field}
                        data-testid="input-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Repeat new password"
                        {...field}
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={passwordMutation.isPending}
                  data-testid="button-change-password"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {passwordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <DisplayPreferencesCard />
    </div>
  );
}

/**
 * Display preferences — for now just the glossary inline-mode toggle.
 * Lives at the bottom of /account so it's discoverable but never
 * blocks the profile or password flows.
 */
function DisplayPreferencesCard() {
  const { inlineMode, isExplicit, roleDefault, setPreference } = useGlossaryPreference();

  return (
    <Card data-testid="card-display-prefs">
      <CardHeader>
        <CardTitle className="text-base">Display preferences</CardTitle>
        <CardDescription>
          Personal settings that change how information is shown to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="inline-glossary" className="text-sm font-medium">
              Show definitions inline
            </Label>
            <p className="text-xs text-muted-foreground">
              When on, medical and DOH terms are followed by a short
              plain-language definition (e.g. "MAM (Moderate Acute
              Malnutrition)"). When off, the same definitions are still
              available — tap any <span className="font-mono">?</span> icon
              next to a term.
            </p>
            <p className="text-xs text-muted-foreground">
              Default for your role: <span className="font-medium">{roleDefault === "on" ? "On" : "Off"}</span>
              {!isExplicit && <> (currently using the default)</>}
            </p>
          </div>
          <Switch
            id="inline-glossary"
            checked={inlineMode}
            onCheckedChange={(v) => setPreference(v ? "on" : "off")}
            data-testid="toggle-inline-glossary"
          />
        </div>
        {isExplicit && (
          <Button
            variant="ghost"
            size="sm"
            className="px-0 h-auto text-primary underline-offset-4 hover:underline"
            onClick={() => setPreference("default")}
            data-testid="reset-inline-glossary"
          >
            Reset to role default
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
