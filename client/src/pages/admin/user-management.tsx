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
import { Users, Shield, Search, Edit, MapPin } from "lucide-react";

interface UserWithAssignments {
  id: string;
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
  const { canManageUsers } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedBarangays, setSelectedBarangays] = useState<number[]>([]);

  const { data: users = [], isLoading } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/admin/users"],
    enabled: canManageUsers,
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role, status }: { userId: string; role: string; status: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}`, { role, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
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

  const openEditDialog = (user: UserWithAssignments) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedStatus(user.status);
    setSelectedBarangays(user.assignedBarangays.map(b => b.id));
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    
    updateUserMutation.mutate({
      userId: editingUser.id,
      role: selectedRole,
      status: selectedStatus,
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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Users ({users.length})
            </CardTitle>
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
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {user.firstName} {user.lastName}
                        {user.status === "DISABLED" && (
                          <Badge variant="outline" className="ml-2 text-xs">Disabled</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
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
                                {editingUser.firstName} {editingUser.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{editingUser.email}</p>
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

                            <div className="flex justify-end gap-2 pt-4">
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
