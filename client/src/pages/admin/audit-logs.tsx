import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: number;
  userId: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  barangayName: string | null;
  beforeJson: any;
  afterJson: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  LOGIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  VIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  GENERATE_REPORT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  IMPORT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function AuditLogs() {
  const { canViewAuditLogs } = useAuth();
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    barangayName: "",
  });

  const queryParams = new URLSearchParams();
  if (filters.action) queryParams.set("action", filters.action);
  if (filters.entityType) queryParams.set("entityType", filters.entityType);
  if (filters.barangayName) queryParams.set("barangayName", filters.barangayName);

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs", filters],
    queryFn: async () => {
      const response = await fetch(`/api/admin/audit-logs?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
    enabled: canViewAuditLogs,
  });

  const toggleExpand = (logId: number) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  if (!canViewAuditLogs) {
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
          <ClipboardList className="w-6 h-6 text-primary" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground">Track all system actions and changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters(prev => ({ ...prev, action: value === "all" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-filter-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="GENERATE_REPORT">Generate Report</SelectItem>
                  <SelectItem value="IMPORT">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select
                value={filters.entityType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value === "all" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-filter-entity">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MOTHER">Mother</SelectItem>
                  <SelectItem value="CHILD">Child</SelectItem>
                  <SelectItem value="SENIOR">Senior</SelectItem>
                  <SelectItem value="INVENTORY">Inventory</SelectItem>
                  <SelectItem value="DISEASE_CASE">Disease Case</SelectItem>
                  <SelectItem value="TB_PATIENT">TB Patient</SelectItem>
                  <SelectItem value="CONSULT">Consult</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Barangay</Label>
              <Input
                placeholder="Filter by barangay..."
                value={filters.barangayName}
                onChange={(e) => setFilters(prev => ({ ...prev, barangayName: e.target.value }))}
                data-testid="input-filter-barangay"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">No audit logs found</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={actionColors[log.action] || ""}>
                        {log.action}
                      </Badge>
                      <span className="font-medium">{log.entityType}</span>
                      {log.entityId && (
                        <span className="text-sm text-muted-foreground">#{log.entityId}</span>
                      )}
                      {log.barangayName && (
                        <Badge variant="outline">{log.barangayName}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                      {expandedLog === log.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="border-t p-4 bg-muted/50 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">User ID:</span>
                          <span className="ml-2 font-mono">{log.userId}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Role:</span>
                          <span className="ml-2">{log.userRole}</span>
                        </div>
                        {log.ipAddress && (
                          <div>
                            <span className="text-muted-foreground">IP Address:</span>
                            <span className="ml-2 font-mono">{log.ipAddress}</span>
                          </div>
                        )}
                      </div>

                      {(log.beforeJson || log.afterJson) && (
                        <div className="grid grid-cols-2 gap-4">
                          {log.beforeJson && (
                            <div>
                              <p className="text-sm font-medium mb-1">Before:</p>
                              <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                                {JSON.stringify(log.beforeJson, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.afterJson && (
                            <div>
                              <p className="text-sm font-medium mb-1">After:</p>
                              <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                                {JSON.stringify(log.afterJson, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
