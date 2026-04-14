import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole } from "@/hooks/use-auth";
import {
  Users, Shield, Search, Edit, MapPin, Plus, Trash2, Key,
  CheckCircle, XCircle, Clock, Eye, UserCheck, UserX,
  PhoneCall, Mail, Calendar, IdCard, ScanFace, AlertCircle, HelpCircle,
} from "lucide-react";

interface UserWithAssignments {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  fullName: string | null;
  contactNumber: string | null;
  kycIdType: string | null;
  kycNotes: string | null;
  kycReviewedAt: string | null;
  /** True if a government ID file was uploaded (raw filename is never returned) */
  hasKycIdFile: boolean;
  /** True if a selfie was uploaded (raw filename is never returned) */
  hasKycSelfie: boolean;
  /** AI face-match result status */
  kycFaceMatchStatus: string | null;
  /** Confidence score 0.0–1.0 float (0 when not computable) */
  kycFaceMatchScore: number | null; // null = not yet run; 0 = run but score unavailable
  /** Brief explanation from AI */
  kycFaceMatchReason: string | null;
  assignedBarangays: { id: number; name: string }[];
}

interface CreateUserPayload {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  barangayIds?: number[];
}

interface UpdateUserPayload {
  userId: string;
  role?: string;
  status?: string;
  password?: string;
}

interface ResetPasswordPayload {
  userId: string;
  password: string;
}

interface Barangay {
  id: number;
  name: string;
}

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  MHO: "Municipal Health Officer",
  SHA: "Senior Health Admin",
  TL: "Team Leader (Barangay Nurse)",
};

const roleColors: Record<string, string> = {
  SYSTEM_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  MHO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  SHA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  TL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function formatScore(score: number | null, meaningful = true): string {
  if (!meaningful || score === null || score === undefined || score === 0) return "";
  return ` · ${Math.round(score * 100)}%`;
}

function FaceMatchBadge({ status, score, reason }: { status: string | null; score: number | null; reason: string | null }) {
  if (!status || status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="AI face verification is running...">
        <HelpCircle className="w-3.5 h-3.5" />AI Check: Pending
      </span>
    );
  }
  if (status === "HIGH_MATCH") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full" title={reason || ""}>
        <CheckCircle className="w-3.5 h-3.5" />High Match{formatScore(score)}
      </span>
    );
  }
  if (status === "POSSIBLE_MATCH") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full" title={reason || ""}>
        <AlertCircle className="w-3.5 h-3.5" />Possible Match{formatScore(score)}
      </span>
    );
  }
  if (status === "LOW_MATCH") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded-full" title={reason || ""}>
        <XCircle className="w-3.5 h-3.5" />Low Match{formatScore(score)}
      </span>
    );
  }
  if (status === "INCONCLUSIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded-full" title={reason || ""}>
        <AlertCircle className="w-3.5 h-3.5" />Inconclusive — Verify Manually
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded-full" title={reason || ""}>
      <AlertCircle className="w-3.5 h-3.5" />Verify Manually
    </span>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Active</Badge>;
    case "DISABLED":
      return <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>;
    case "PENDING_VERIFICATION":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">Pending</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">Rejected</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

export default function UserManagement() {
  const { canManageUsers, user: currentUser } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedBarangays, setSelectedBarangays] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState("");

  // Reset password dialog
  const [resetPwUser, setResetPwUser] = useState<UserWithAssignments | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("TL");
  const [newBarangayAssignments, setNewBarangayAssignments] = useState<number[]>([]);

  // KYC review dialog
  const [reviewingUser, setReviewingUser] = useState<UserWithAssignments | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/admin/users"],
    enabled: canManageUsers,
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
  });

  // Derived lists
  const pendingUsers = users.filter(u => u.status === "PENDING_VERIFICATION");
  const activeUsers = users.filter(u => u.status !== "PENDING_VERIFICATION");

  const filteredUsers = activeUsers.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.fullName?.toLowerCase().includes(searchLower)
    );
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserPayload) => {
      const response = await apiRequest("POST", "/api/admin/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User created successfully" });
      setCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, ...data }: UpdateUserPayload) => {
      return apiRequest("PUT", `/api/admin/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    },
  });

  const updateBarangaysMutation = useMutation({
    mutationFn: async ({ userId, barangayIds }: { userId: string; barangayIds: number[] }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/barangays`, { barangayIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update assignments", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => apiRequest("DELETE", `/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: ResetPasswordPayload) => {
      return apiRequest("PUT", `/api/admin/users/${userId}`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Password reset successfully" });
      setResetPwUser(null);
      setResetPwValue("");
      setResetPwConfirm("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User approved", description: "Account is now active." });
      setReviewingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to approve user", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId, note }: { userId: string; note: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reject`, { note });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Registration rejected" });
      setReviewingUser(null);
      setRejectDialogOpen(false);
      setRejectNote("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject user", description: error.message, variant: "destructive" });
    },
  });

  const quickDisableMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}`, { status: newStatus });
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: newStatus === "DISABLED" ? "User disabled" : "User re-enabled" });
    },
    onError: (error: Error) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const resetCreateForm = () => {
    setNewUsername(""); setNewUserPassword(""); setNewFirstName("");
    setNewLastName(""); setNewEmail(""); setNewRole("TL"); setNewBarangayAssignments([]);
  };

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newUserPassword.trim()) {
      toast({ title: "Username and password are required", variant: "destructive" }); return;
    }
    if (newUserPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    if (newRole === UserRole.TL && newBarangayAssignments.length === 0) {
      toast({ title: "Please assign at least one barangay for Team Leader", variant: "destructive" }); return;
    }
    createUserMutation.mutate({
      username: newUsername.trim(),
      password: newUserPassword,
      firstName: newFirstName.trim() || undefined,
      lastName: newLastName.trim() || undefined,
      email: newEmail.trim() || undefined,
      role: newRole,
      barangayIds: newRole === UserRole.TL ? newBarangayAssignments : undefined,
    });
  };

  const openEditDialog = (user: UserWithAssignments) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedStatus(user.status);
    setSelectedBarangays(user.assignedBarangays.map(b => b.id));
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    if (selectedRole === UserRole.TL && selectedBarangays.length === 0) {
      toast({ title: "Team Leader must be assigned to at least one barangay", variant: "destructive" }); return;
    }
    updateUserMutation.mutate({ userId: editingUser.id, role: selectedRole, status: selectedStatus, password: newPassword.trim() || undefined });
    if (selectedRole === UserRole.TL) {
      updateBarangaysMutation.mutate({ userId: editingUser.id, barangayIds: selectedBarangays });
    }
  };

  const toggleBarangay = (id: number) => setSelectedBarangays(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  const toggleNewBarangay = (id: number) => setNewBarangayAssignments(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);

  const displayName = (u: UserWithAssignments) =>
    u.fullName || (u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : u.username);

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">You don't have permission to access this page.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Users className="w-6 h-6 text-primary" />
          User Management
        </h1>
        <p className="text-muted-foreground">Manage user accounts, roles, and KYC verifications</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-users">
            All Users ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-approvals">
            Pending Approvals
            {pendingUsers.length > 0 && (
              <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === ALL USERS TAB === */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  System Users
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-users"
                    />
                  </div>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-user">
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Username *</Label>
                          <Input placeholder="Enter username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} data-testid="input-new-username" />
                        </div>
                        <div className="space-y-2">
                          <Label>Password * (min 6 characters)</Label>
                          <Input type="password" placeholder="Enter password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} data-testid="input-new-password" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input placeholder="First name" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} data-testid="input-new-firstname" />
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input placeholder="Last name" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} data-testid="input-new-lastname" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Email (optional)</Label>
                          <Input type="email" placeholder="Email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="input-new-email" />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(roleLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {newRole === UserRole.TL && (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" />Assigned Barangays *</Label>
                            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto">
                              {barangays.map(b => (
                                <div key={b.id} className="flex items-center space-x-2">
                                  <Checkbox id={`nb-${b.id}`} checked={newBarangayAssignments.includes(b.id)} onCheckedChange={() => toggleNewBarangay(b.id)} data-testid={`checkbox-new-barangay-${b.id}`} />
                                  <label htmlFor={`nb-${b.id}`} className="text-sm cursor-pointer">{b.name}</label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                          <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}>Cancel</Button>
                          <Button onClick={handleCreateUser} disabled={createUserMutation.isPending} data-testid="button-submit-create-user">
                            {createUserMutation.isPending ? "Creating..." : "Create User"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-muted-foreground">No users found</p>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border bg-card" data-testid={`user-row-${user.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {displayName(user)}
                            {statusBadge(user.status)}
                          </p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <Badge className={roleColors[user.role] || ""}>{roleLabels[user.role] || user.role}</Badge>
                        {user.role === UserRole.TL && user.assignedBarangays.length > 0 && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            {user.assignedBarangays.map(b => b.name).join(", ")}
                          </div>
                        )}

                        {/* Quick Disable/Enable */}
                        {user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => quickDisableMutation.mutate({ userId: user.id, newStatus: user.status === "DISABLED" ? "ACTIVE" : "DISABLED" })}
                            disabled={quickDisableMutation.isPending}
                            data-testid={`button-toggle-status-${user.id}`}
                            title={user.status === "DISABLED" ? "Re-enable account" : "Disable account"}
                          >
                            {user.status === "DISABLED" ? <UserCheck className="w-4 h-4 text-green-600" /> : <UserX className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                        )}

                        <Button variant="outline" size="sm" onClick={() => { setResetPwUser(user); setResetPwValue(""); setResetPwConfirm(""); }} data-testid={`button-reset-password-${user.id}`}>
                          <Key className="w-4 h-4 mr-1" />Reset PW
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} data-testid={`button-edit-user-${user.id}`}>
                              <Edit className="w-4 h-4 mr-1" />Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
                            {editingUser && (
                              <div className="space-y-4 pt-4">
                                <div>
                                  <p className="font-medium">{displayName(editingUser)}</p>
                                  <p className="text-sm text-muted-foreground">@{editingUser.username}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label>Role</Label>
                                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(roleLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger data-testid="select-user-status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ACTIVE">Active</SelectItem>
                                      <SelectItem value="DISABLED">Disabled</SelectItem>
                                      <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-2"><Key className="w-4 h-4" />Reset Password</Label>
                                  <Input type="password" placeholder="Leave blank to keep current" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="input-reset-password" />
                                </div>
                                {selectedRole === UserRole.TL && (
                                  <div className="space-y-2">
                                    <Label>Assigned Barangays</Label>
                                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto">
                                      {barangays.map(b => (
                                        <div key={b.id} className="flex items-center space-x-2">
                                          <Checkbox id={`eb-${b.id}`} checked={selectedBarangays.includes(b.id)} onCheckedChange={() => toggleBarangay(b.id)} data-testid={`checkbox-barangay-${b.id}`} />
                                          <label htmlFor={`eb-${b.id}`} className="text-sm cursor-pointer">{b.name}</label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-between gap-2 pt-4">
                                  {editingUser.id !== currentUser?.id && (
                                    <Button variant="destructive" onClick={() => { if (confirm("Delete this user? This cannot be undone.")) { deleteUserMutation.mutate(editingUser.id); setEditingUser(null); } }} disabled={deleteUserMutation.isPending} data-testid="button-delete-user">
                                      <Trash2 className="w-4 h-4 mr-1" />Delete
                                    </Button>
                                  )}
                                  <div className="flex-1" />
                                  <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending} data-testid="button-save-user">
                                    {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PENDING APPROVALS TAB === */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                Pending Registrations ({pendingUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/40" />
                  <p>No pending registrations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="rounded-lg border bg-card p-4 space-y-3" data-testid={`pending-user-${user.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-base">{user.fullName || displayName(user)}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            {user.contactNumber && (
                              <span className="flex items-center gap-1">
                                <PhoneCall className="w-3.5 h-3.5" />{user.contactNumber}
                              </span>
                            )}
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />{user.email}
                              </span>
                            )}
                            {user.createdAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Submitted {new Date(user.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={roleColors[user.role] || ""}>{roleLabels[user.role] || user.role}</Badge>
                          {user.role === UserRole.TL && user.assignedBarangays.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {user.assignedBarangays.map(b => b.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* KYC info */}
                      {(user.kycIdType || user.hasKycIdFile) && (
                        <div className="rounded-md bg-muted/50 p-3 space-y-2">
                          {user.kycIdType && (
                            <p className="text-sm flex items-center gap-2">
                              <IdCard className="w-4 h-4 text-primary" />
                              <strong>ID Type:</strong> {user.kycIdType}
                            </p>
                          )}

                          {/* AI Face-Match Result */}
                          <div className="flex items-start gap-2">
                            <ScanFace className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-foreground">AI Face Verification</p>
                              <FaceMatchBadge
                                status={user.kycFaceMatchStatus}
                                score={user.kycFaceMatchScore}
                                reason={user.kycFaceMatchReason}
                              />
                              {user.kycFaceMatchReason && user.kycFaceMatchStatus && (
                                <p className="text-xs text-muted-foreground italic">{user.kycFaceMatchReason}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Advisory only — admin decision required.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            {user.hasKycIdFile && (
                              <a
                                href={`/api/admin/kyc-files/${user.id}?type=id`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary underline"
                                data-testid={`link-view-kyc-id-${user.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />View ID Document
                              </a>
                            )}
                            {user.hasKycSelfie && (
                              <a
                                href={`/api/admin/kyc-files/${user.id}?type=selfie`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary underline"
                                data-testid={`link-view-selfie-${user.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />View Selfie
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap pt-1">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => approveMutation.mutate(user.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${user.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setReviewingUser(user); setRejectNote(""); setRejectDialogOpen(true); }}
                          data-testid={`button-reject-${user.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { if (confirm("Delete this registration permanently?")) deleteUserMutation.mutate(user.id); }}
                          disabled={deleteUserMutation.isPending}
                          data-testid={`button-delete-pending-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === Reset Password Dialog === */}
      <Dialog open={!!resetPwUser} onOpenChange={(open) => { if (!open) { setResetPwUser(null); setResetPwValue(""); setResetPwConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Reset Password</DialogTitle>
          </DialogHeader>
          {resetPwUser && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Set a new password for <strong>@{resetPwUser.username}</strong>.</p>
              <div className="space-y-2">
                <Label>New Password (min 8 characters)</Label>
                <Input type="password" placeholder="Enter new password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} data-testid="input-admin-reset-password" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="Confirm new password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} data-testid="input-admin-reset-password-confirm" />
                {resetPwConfirm && resetPwValue !== resetPwConfirm && <p className="text-xs text-destructive">Passwords do not match</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setResetPwUser(null); setResetPwValue(""); setResetPwConfirm(""); }}>Cancel</Button>
                <Button onClick={() => {
                  if (!resetPwValue || resetPwValue.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
                  if (resetPwValue !== resetPwConfirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
                  resetPasswordMutation.mutate({ userId: resetPwUser.id, password: resetPwValue });
                }} disabled={resetPasswordMutation.isPending} data-testid="button-confirm-reset-password">
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === Reject Dialog === */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setReviewingUser(null); setRejectNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />Reject Registration
            </DialogTitle>
          </DialogHeader>
          {reviewingUser && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                You are rejecting the registration of <strong>{reviewingUser.fullName || reviewingUser.username}</strong>.
                Please provide a reason so the applicant knows why they were not approved.
              </p>
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="e.g. ID photo is unclear. Please re-register with a clearer image."
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  data-testid="input-rejection-reason"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setReviewingUser(null); setRejectNote(""); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!rejectNote.trim()) { toast({ title: "Please provide a rejection reason", variant: "destructive" }); return; }
                    rejectMutation.mutate({ userId: reviewingUser.id, note: rejectNote.trim() });
                  }}
                  disabled={rejectMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Reject Registration"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
