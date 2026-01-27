import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth, UserRole } from "@/hooks/use-auth";
import { Users, Shield, Search, Edit, MapPin, Plus, Trash2, Key } from "lucide-react";

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
  assignedBarangays: { id: number; name: string }[];
}

interface Barangay {
  id: number;
  name: string;
}

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  MHO: "Municipal Health Officer",
  SHA: "Senior Health Admin",
  TL: "Team Leader",
};

const roleColors: Record<string, string> = {
  SYSTEM_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  MHO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  SHA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  TL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function UserManagement() {
  const { canManageUsers, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedBarangays, setSelectedBarangays] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState("");
  
  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("TL");
  const [newBarangayAssignments, setNewBarangayAssignments] = useState<number[]>([]);

  const { data: users = [], isLoading } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/admin/users"],
    enabled: canManageUsers,
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; firstName?: string; lastName?: string; email?: string; role: string; barangayIds?: number[] }) => {
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
    mutationFn: async ({ userId, role, status, password, firstName, lastName, email }: { userId: string; role: string; status: string; password?: string; firstName?: string; lastName?: string; email?: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}`, { role, status, password, firstName, lastName, email });
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
      toast({ title: "Barangay assignments updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update assignments", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const resetCreateForm = () => {
    setNewUsername("");
    setNewUserPassword("");
    setNewFirstName("");
    setNewLastName("");
    setNewEmail("");
    setNewRole("TL");
    setNewBarangayAssignments([]);
  };

  const toggleNewBarangay = (barangayId: number) => {
    setNewBarangayAssignments((prev) =>
      prev.includes(barangayId)
        ? prev.filter((id) => id !== barangayId)
        : [...prev, barangayId]
    );
  };

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newUserPassword.trim()) {
      toast({ title: "Username and password are required", variant: "destructive" });
      return;
    }
    if (newUserPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newRole === UserRole.TL && newBarangayAssignments.length === 0) {
      toast({ title: "Please assign at least one barangay for Team Leader", variant: "destructive" });
      return;
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
    
    // Validate TL users must have at least one barangay
    if (selectedRole === UserRole.TL && selectedBarangays.length === 0) {
      toast({ title: "Team Leaders must be assigned to at least one barangay", variant: "destructive" });
      return;
    }
    
    updateUserMutation.mutate({
      userId: editingUser.id,
      role: selectedRole,
      status: selectedStatus,
      password: newPassword.trim() || undefined,
    });
    
    if (selectedRole === UserRole.TL) {
      updateBarangaysMutation.mutate({
        userId: editingUser.id,
        barangayIds: selectedBarangays,
      });
    }
  };

  const toggleBarangay = (barangayId: number) => {
    setSelectedBarangays(prev =>
      prev.includes(barangayId)
        ? prev.filter(id => id !== barangayId)
        : [...prev, barangayId]
    );
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower)
    );
  });

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
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
        <p className="text-muted-foreground">Manage user roles and barangay assignments</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Users ({users.length})
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
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Username *</Label>
                      <Input
                        placeholder="Enter username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        data-testid="input-new-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password * (min 6 characters)</Label>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        data-testid="input-new-password"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          placeholder="First name"
                          value={newFirstName}
                          onChange={(e) => setNewFirstName(e.target.value)}
                          data-testid="input-new-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          placeholder="Last name"
                          value={newLastName}
                          onChange={(e) => setNewLastName(e.target.value)}
                          data-testid="input-new-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email (optional)</Label>
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        data-testid="input-new-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger data-testid="select-new-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newRole === UserRole.TL && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Assigned Barangays *
                        </Label>
                        <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                          {barangays.map((barangay) => (
                            <div key={barangay.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`new-brgy-${barangay.id}`}
                                checked={newBarangayAssignments.includes(barangay.id)}
                                onCheckedChange={() => toggleNewBarangay(barangay.id)}
                                data-testid={`checkbox-new-barangay-${barangay.id}`}
                              />
                              <label
                                htmlFor={`new-brgy-${barangay.id}`}
                                className="text-sm cursor-pointer"
                              >
                                {barangay.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Team Leaders can only access data from their assigned barangays
                        </p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateDialogOpen(false);
                          resetCreateForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending}
                        data-testid="button-submit-create-user"
                      >
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
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username}
                        {user.status === "DISABLED" && (
                          <Badge variant="outline" className="ml-2 text-xs">Disabled</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge className={roleColors[user.role] || ""}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                    
                    {user.role === UserRole.TL && user.assignedBarangays.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {user.assignedBarangays.map(b => b.name).join(", ")}
                      </div>
                    )}

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit User</DialogTitle>
                        </DialogHeader>
                        {editingUser && (
                          <div className="space-y-4 pt-4">
                            <div>
                              <p className="font-medium">
                                {editingUser.firstName || editingUser.lastName 
                                  ? `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() 
                                  : editingUser.username}
                              </p>
                              <p className="text-sm text-muted-foreground">@{editingUser.username}</p>
                            </div>

                            <div className="space-y-2">
                              <Label>Role</Label>
                              <Select
                                value={selectedRole}
                                onValueChange={setSelectedRole}
                              >
                                <SelectTrigger data-testid="select-user-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(roleLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select
                                value={selectedStatus}
                                onValueChange={setSelectedStatus}
                              >
                                <SelectTrigger data-testid="select-user-status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ACTIVE">Active</SelectItem>
                                  <SelectItem value="DISABLED">Disabled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Key className="w-4 h-4" />
                                Reset Password
                              </Label>
                              <Input
                                type="password"
                                placeholder="Leave blank to keep current password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                data-testid="input-reset-password"
                              />
                              <p className="text-xs text-muted-foreground">
                                Enter a new password (min 6 characters) to reset
                              </p>
                            </div>

                            {selectedRole === UserRole.TL && (
                              <div className="space-y-2">
                                <Label>Assigned Barangays</Label>
                                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                                  {barangays.map((barangay) => (
                                    <div key={barangay.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`brgy-${barangay.id}`}
                                        checked={selectedBarangays.includes(barangay.id)}
                                        onCheckedChange={() => toggleBarangay(barangay.id)}
                                        data-testid={`checkbox-barangay-${barangay.id}`}
                                      />
                                      <label
                                        htmlFor={`brgy-${barangay.id}`}
                                        className="text-sm cursor-pointer"
                                      >
                                        {barangay.name}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Team Leaders can only access data from their assigned barangays
                                </p>
                              </div>
                            )}

                            <div className="flex justify-between gap-2 pt-4">
                              {editingUser.id !== currentUser?.id && (
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
                                      deleteUserMutation.mutate(editingUser.id);
                                      setEditingUser(null);
                                    }
                                  }}
                                  disabled={deleteUserMutation.isPending}
                                  data-testid="button-delete-user"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              )}
                              <div className="flex-1" />
                              <Button
                                onClick={handleSaveUser}
                                disabled={updateUserMutation.isPending}
                                data-testid="button-save-user"
                              >
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
    </div>
  );
}
