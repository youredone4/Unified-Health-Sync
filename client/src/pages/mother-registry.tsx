import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother } from "@shared/schema";
import { formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";
import { useState } from "react";

export default function MotherRegistry() {
  const [, navigate] = useLocation();
  const { data: mothers = [], isLoading } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const [search, setSearch] = useState('');

  const filtered = mothers.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    m.barangay.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Users className="w-6 h-6" />
          Mother Registry
        </h1>
        <p className="text-muted-foreground">All registered mothers</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name or barangay..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Phone</th>
                  <th className="text-left py-2 px-3">Registered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr 
                    key={m.id}
                    onClick={() => navigate(`/mother/${m.id}`)}
                    className="border-b border-border/50 cursor-pointer hover-elevate"
                    data-testid={`row-mother-${m.id}`}
                  >
                    <td className="py-3 px-3 font-medium">{m.firstName} {m.lastName}</td>
                    <td className="py-3 px-3">{m.age}</td>
                    <td className="py-3 px-3">{m.barangay}</td>
                    <td className="py-3 px-3">{m.phone || '-'}</td>
                    <td className="py-3 px-3">{formatDate(m.registrationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
