import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { DohUpdate, DohUpdateSignificance } from "@shared/schema";

const SIG_TONE: Record<DohUpdateSignificance, "default" | "destructive" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "default",
  LOW: "secondary",
};

const BUREAU_LABEL: Record<string, string> = {
  HFDB: "Health Facilities Dev. Bureau",
  DPCB: "Disease Prevention & Control",
  CHD: "Center for Health Development",
  HHRDB: "Health Human Resources Dev.",
  OTHER: "DOH",
};

/**
 * Card for the TL home page (/today) showing the most recent significant
 * DOH updates. Each entry is a one-click jump to the official source. The
 * "View all updates" footer takes the user to the full /updates page.
 *
 * Visible to all authenticated roles — DOH guidance applies regardless of
 * whether you're a barangay nurse or a mayor.
 */
export function DohUpdatesCard({ limit = 4 }: { limit?: number }) {
  const { data: updates = [], isLoading } = useQuery<DohUpdate[]>({
    queryKey: [`/api/doh-updates?limit=${limit}`],
  });

  if (!isLoading && updates.length === 0) return null;

  return (
    <Card data-testid="card-doh-updates">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" aria-hidden /> Recent DOH updates
        </CardTitle>
        <Link href="/updates">
          <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="doh-updates-view-all">
            View all <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2 text-center">Loading…</p>
        ) : (
          <ul className="space-y-2 list-none p-0">
            {updates.map((u) => (
              <li
                key={u.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/40"
                data-testid={`doh-update-${u.id}`}
              >
                <Badge variant={SIG_TONE[u.significance]} className="text-[10px] mt-0.5">
                  {u.significance}
                </Badge>
                <div className="flex-1 min-w-0">
                  <a
                    href={u.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline inline-flex items-center gap-1"
                    data-testid={`doh-update-link-${u.id}`}
                  >
                    {u.title}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  <p className="text-xs text-muted-foreground line-clamp-2">{u.summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {BUREAU_LABEL[u.bureau] ?? u.bureau} ·{" "}
                    {(() => {
                      try { return format(new Date(u.publishedDate), "MMM d, yyyy"); }
                      catch { return u.publishedDate; }
                    })()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
