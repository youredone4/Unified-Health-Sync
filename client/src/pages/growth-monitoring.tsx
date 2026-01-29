import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { formatDate, getAgeInMonths } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Scale, TrendingUp, Search, MapPin, Users } from "lucide-react";

interface Barangay {
  id: number;
  name: string;
}

export default function GrowthMonitoring() {
  const [, navigate] = useLocation();
  const [nameFilter, setNameFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });

  const childrenWithGrowth = children.filter(c => (c.growth || []).length > 0);

  const filteredChildren = useMemo(() => {
    return childrenWithGrowth.filter(c => {
      const matchesName = nameFilter === "" || 
        c.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesBarangay = barangayFilter === "all" || c.barangay === barangayFilter;
      return matchesName && matchesBarangay;
    });
  }, [childrenWithGrowth, nameFilter, barangayFilter]);

  const uniqueBarangays = useMemo(() => {
    const fromChildren = Array.from(new Set(childrenWithGrowth.map(c => c.barangay)));
    const fromApi = barangays.map(b => b.name);
    const combined = new Set([...fromChildren, ...fromApi]);
    return Array.from(combined).sort();
  }, [childrenWithGrowth, barangays]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <TrendingUp className="w-6 h-6 text-green-400" />
          Growth Monitoring
        </h1>
        <p className="text-muted-foreground">Track child weight over time</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="badge-total-children">
                <Users className="w-3 h-3 mr-1" />
                {filteredChildren.length} of {childrenWithGrowth.length} children
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-name-filter"
                />
              </div>
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-barangay-filter">
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Barangays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {uniqueBarangays.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Child</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Measurements</th>
                  <th className="text-left py-2 px-3">Latest Weight</th>
                  <th className="text-left py-2 px-3">Last Measured</th>
                </tr>
              </thead>
              <tbody>
                {filteredChildren.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {childrenWithGrowth.length === 0 
                        ? "No children with growth measurements yet"
                        : "No children match the current filters"}
                    </td>
                  </tr>
                ) : (
                  filteredChildren.map(c => {
                    const growth = c.growth || [];
                    const lastGrowth = growth[growth.length - 1];
                    
                    return (
                      <tr 
                        key={c.id}
                        onClick={() => navigate(`/child/${c.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/child/${c.id}`);
                          }
                        }}
                        className="border-b border-border/50 cursor-pointer hover-elevate"
                        data-testid={`row-growth-${c.id}`}
                      >
                        <td className="py-3 px-3 font-medium">{c.name}</td>
                        <td className="py-3 px-3">{getAgeInMonths(c.dob)} months</td>
                        <td className="py-3 px-3">{c.barangay}</td>
                        <td className="py-3 px-3">{growth.length}</td>
                        <td className="py-3 px-3">{lastGrowth ? `${lastGrowth.weightKg} kg` : '-'}</td>
                        <td className="py-3 px-3">{lastGrowth ? formatDate(lastGrowth.date) : '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
