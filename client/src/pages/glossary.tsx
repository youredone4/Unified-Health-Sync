import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";
import { allTerms } from "@shared/glossary";

/**
 * Canonical reference page — every term in shared/glossary.ts shown
 * alphabetically with search. Sidebar-linked from "DOH Updates" group;
 * also referenced from popup-tip footers.
 *
 * Pure read-only — no API call, the glossary is shipped in the bundle.
 */
export default function GlossaryPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = allTerms();
    if (!q) return all;
    return all.filter(({ term, entry }) =>
      term.toLowerCase().includes(q) ||
      entry.short.toLowerCase().includes(q) ||
      (entry.long ?? "").toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="glossary-title">
          <BookOpen className="w-5 h-5 text-primary" aria-hidden /> Glossary
        </h1>
        <p className="text-sm text-muted-foreground">
          Plain-language definitions for medical and DOH terms used throughout
          HealthSync. Search by term, summary, or detail. Tap any{" "}
          <span className="font-mono">?</span> icon next to a term elsewhere in the
          app to see the same definition in a popup.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search glossary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search glossary"
          data-testid="glossary-search"
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground">
          No terms match "{search.trim()}".
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {filtered.map(({ term, entry }) => (
              <div
                key={term}
                className="border-b last:border-b-0 pb-3 last:pb-0"
                data-testid={`glossary-row-${term}`}
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <p className="font-semibold text-base">{term}</p>
                  {entry.source && (
                    <Badge variant="outline" className="text-[10px]">
                      {entry.source}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground mt-0.5">{entry.short}</p>
                {entry.long && (
                  <p className="text-xs text-muted-foreground mt-1">{entry.long}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2">
        {filtered.length} term{filtered.length === 1 ? "" : "s"} shown
      </p>
    </div>
  );
}
