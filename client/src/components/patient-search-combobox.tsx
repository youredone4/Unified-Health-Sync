import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, UserPlus, Heart, Baby, Stethoscope, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PatientKind = "MOTHER" | "CHILD" | "SENIOR" | "TB_PATIENT";

export interface PatientSearchResult {
  kind: PatientKind;
  id: number;
  displayName: string;
  dob: string | null;
  sex: "M" | "F" | null;
  barangay: string;
  hint: string;
}

export type PatientLink =
  | { kind: PatientKind; id: number; displayName: string; barangay: string }
  | { kind: "FREE_TEXT"; displayName: string; barangay?: string };

interface Props {
  /** Currently selected patient link, if any. */
  value: PatientLink | null;
  /** Called whenever the operator picks an existing record OR confirms a typed name. */
  onChange: (link: PatientLink | null) => void;
  /** Placeholder for the search input. */
  placeholder?: string;
  /** Disabled state — e.g. while a parent form is submitting. */
  disabled?: boolean;
  /** Optional test-id passthrough. */
  testId?: string;
}

const KIND_STYLE: Record<PatientKind, { label: string; chip: string; icon: typeof Heart }> = {
  MOTHER:     { label: "Mother",   chip: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-200",     icon: Heart },
  CHILD:      { label: "Child",    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",         icon: Baby },
  SENIOR:     { label: "Senior",   chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200", icon: Stethoscope },
  TB_PATIENT: { label: "TB DOTS",  chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",     icon: Activity },
};

/**
 * Cross-registry patient search combobox.
 *
 * Honors "capture once → shows up everywhere": when a TL types a name on
 * any patient-capture form, the combobox queries every existing registry
 * (mothers + children + seniors + tb_patients, server-side, RBAC-scoped)
 * and offers the existing record. Selecting it returns a structured
 * { kind, id, displayName, barangay } link. Typing a brand-new name and
 * pressing Enter (or clicking "Create new") returns a FREE_TEXT link
 * with just the name, preserving the current free-text behavior for
 * walk-ins not yet in the system.
 *
 * Drop-in usage from any form:
 *
 *   <PatientSearchCombobox
 *     value={patientLink}
 *     onChange={setPatientLink}
 *     placeholder="Search or type patient name…"
 *   />
 *
 * Then on submit, the form derives the persisted shape:
 *   linkedPersonType = patientLink.kind === "FREE_TEXT" ? null : patientLink.kind
 *   linkedPersonId   = patientLink.kind === "FREE_TEXT" ? null : patientLink.id
 *   patientName      = patientLink.displayName
 */
export function PatientSearchCombobox({
  value,
  onChange,
  placeholder = "Search patient by name…",
  disabled,
  testId = "patient-search-combobox",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce 300 ms — busy clinic typing shouldn't fire a DB query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useQuery<PatientSearchResult[]>({
    queryKey: ["/api/patients/search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(debounced)}&limit=10`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("patient search failed");
      return res.json();
    },
    staleTime: 30_000, // half a minute is plenty for a "have you typed this name today?" cache
  });

  // The "Create new — use typed name as-is" affordance shown at the
  // bottom of the popover. Active whenever the operator has typed a
  // non-empty name that doesn't exactly match an existing result.
  const canCreateFromTyped = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return false;
    const exact = results.some((r) => r.displayName.toLowerCase() === trimmed.toLowerCase());
    return !exact;
  }, [query, results]);

  // Render label on the closed button.
  const buttonLabel = value
    ? value.kind === "FREE_TEXT"
      ? `${value.displayName} (new)`
      : `${value.displayName} · ${KIND_STYLE[value.kind].label}`
    : "Search patient…";

  const SelectedIcon = value && value.kind !== "FREE_TEXT"
    ? KIND_STYLE[value.kind].icon
    : Search;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <SelectedIcon className="w-4 h-4 shrink-0" aria-hidden />
            <span className="truncate">{buttonLabel}</span>
          </span>
          <ChevronsUpDown className="ml-2 w-4 h-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            data-testid={`${testId}-input`}
          />
          <CommandList>
            {query.trim().length < 2 ? (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            ) : isFetching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No existing patient matches.</CommandEmpty>
            ) : (
              <CommandGroup heading="Existing records">
                {results.map((r) => {
                  const style = KIND_STYLE[r.kind];
                  const Icon = style.icon;
                  const isSelected =
                    value && value.kind !== "FREE_TEXT" &&
                    value.kind === r.kind && value.id === r.id;
                  return (
                    <CommandItem
                      key={`${r.kind}-${r.id}`}
                      value={`${r.kind}-${r.id}`}
                      onSelect={() => {
                        onChange({
                          kind: r.kind,
                          id: r.id,
                          displayName: r.displayName,
                          barangay: r.barangay,
                        });
                        setOpen(false);
                      }}
                      data-testid={`${testId}-result-${r.kind}-${r.id}`}
                      className="flex items-start gap-2"
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-70" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.displayName}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded", style.chip)}>
                            {style.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.hint} · Brgy {r.barangay}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 opacity-80" aria-hidden />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {canCreateFromTyped && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create__${query}`}
                    onSelect={() => {
                      onChange({ kind: "FREE_TEXT", displayName: query.trim() });
                      setOpen(false);
                    }}
                    data-testid={`${testId}-create-new`}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
                    <span>
                      Use as new patient: <span className="font-medium text-foreground">"{query.trim()}"</span>
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
