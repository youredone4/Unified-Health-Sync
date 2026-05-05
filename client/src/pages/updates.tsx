import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, Search, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import type { DohUpdate, DohUpdateSignificance, DohUpdateBureau } from "@shared/schema";
import { useReadUpdates } from "@/hooks/use-read-updates";

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

type SigFilter = "all" | DohUpdateSignificance;
type BureauFilter = "all" | DohUpdateBureau;

/**
 * Full DOH updates feed. Linked from the user menu and the "View all"
 * button on the /today card. Filters by significance + bureau, search by
 * title / summary / tag.
 */
export default function UpdatesPage() {
  const { data: updates = [], isLoading } = useQuery<DohUpdate[]>({
    queryKey: ["/api/doh-updates"],
  });
  const { isRead, markRead, markAllRead, unreadCount } = useReadUpdates();

  const [sig, setSig] = useState<SigFilter>("all");
  const [bureau, setBureau] = useState<BureauFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return updates.filter((u) => {
      if (sig !== "all" && u.significance !== sig) return false;
      if (bureau !== "all" && u.bureau !== bureau) return false;
      if (!q) return true;
      const hay = `${u.title} ${u.summary} ${(u.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [updates, sig, bureau, search]);

  const totalUnread = unreadCount(updates.map((u) => u.id));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="updates-title">
            <Newspaper className="w-5 h-5 text-primary" aria-hidden /> DOH Updates &amp; Memorandums
            {totalUnread > 0 && (
              <Badge variant="default" className="text-xs ml-1" data-testid="updates-unread-count">
                {totalUnread} new
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Curated feed of recent significant DOH circulars, administrative orders, and
            department memoranda that affect HealthSync workflows. Each entry links to
            the official source on doh.gov.ph.
          </p>
        </div>
        {totalUnread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead(updates.map((u) => u.id))}
            className="gap-1.5"
            data-testid="updates-mark-all-read"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search title, summary, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search DOH updates"
            data-testid="updates-search"
          />
        </div>

        <FilterChip active={sig === "all"} onClick={() => setSig("all")} label="All" />
        <FilterChip active={sig === "HIGH"} onClick={() => setSig("HIGH")} label="High" tone="destructive" />
        <FilterChip active={sig === "MEDIUM"} onClick={() => setSig("MEDIUM")} label="Medium" />
        <FilterChip active={sig === "LOW"} onClick={() => setSig("LOW")} label="Low" />

        <span className="mx-2 text-muted-foreground text-xs">|</span>

        <FilterChip active={bureau === "all"} onClick={() => setBureau("all")} label="All bureaus" />
        <FilterChip active={bureau === "HFDB"} onClick={() => setBureau("HFDB")} label="HFDB" />
        <FilterChip active={bureau === "DPCB"} onClick={() => setBureau("DPCB")} label="DPCB" />
        <FilterChip active={bureau === "CHD"} onClick={() => setBureau("CHD")} label="CHD" />
        <FilterChip active={bureau === "HHRDB"} onClick={() => setBureau("HHRDB")} label="HHRDB" />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground" data-testid="updates-empty">
          No DOH updates match the current filters. Try a different significance, bureau, or search term above.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {filtered.map((u) => {
              const read = isRead(u.id);
              return (
              <div
                key={u.id}
                className={`flex items-start gap-3 p-3 rounded-md ${read ? "bg-muted/40" : "bg-primary/5 border-l-2 border-primary"}`}
                data-testid={`update-row-${u.id}`}
              >
                <Badge variant={SIG_TONE[u.significance]} className="text-[10px] mt-0.5 shrink-0">
                  {u.significance}
                </Badge>
                <div className="flex-1 min-w-0">
                  <a
                    href={u.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markRead(u.id)}
                    className="font-medium hover:underline inline-flex items-center gap-1"
                    data-testid={`update-link-${u.id}`}
                  >
                    {u.title}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                    {!read && (
                      <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                        new
                      </Badge>
                    )}
                  </a>
                  <p className="text-sm text-muted-foreground mt-0.5">{u.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{BUREAU_LABEL[u.bureau] ?? u.bureau}</Badge>
                    <span>·</span>
                    <span>
                      {(() => {
                        try { return format(new Date(u.publishedDate), "MMM d, yyyy"); }
                        catch { return u.publishedDate; }
                      })()}
                    </span>
                    {(u.tags ?? []).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "destructive";
}) {
  return (
    <Button
      variant={active ? (tone ?? "default") : "outline"}
      size="sm"
      onClick={onClick}
      className="h-7 text-xs"
      data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </Button>
  );
}
