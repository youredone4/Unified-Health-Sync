import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { lookupTerm } from "@shared/glossary";
import { useGlossaryPreference } from "@/hooks/use-glossary-preference";

interface TermProps {
  /** Glossary key — must match an entry in shared/glossary.ts. */
  name: string;
  /** Override the visible label (defaults to `name`). */
  children?: React.ReactNode;
  /** Force inline gloss regardless of preference (for cases where it's task-vital). */
  forceInline?: boolean;
}

/**
 * Render a glossary-aware term. Shape depends on the user's preference:
 *
 *   inline ON  → "MAM (Moderate Acute Malnutrition)" rendered inline.
 *   inline OFF → "MAM" + a small ? icon. Click/Enter opens a popup tip.
 *
 * Either shape is keyboard- and touch-accessible. Power roles default to
 * inline OFF; viewer roles default to inline ON; any user can flip in
 * Account → Display.
 *
 * If the `name` isn't in the glossary, renders the children/name as plain
 * text — never a broken UI.
 */
export function Term({ name, children, forceInline }: TermProps) {
  const entry = lookupTerm(name);
  const { inlineMode } = useGlossaryPreference();
  const [open, setOpen] = useState(false);

  const label = children ?? name;

  if (!entry) return <>{label}</>;

  const showInline = forceInline || inlineMode;

  if (showInline) {
    return (
      <span className="inline-flex items-baseline gap-1" data-testid={`term-${name}`}>
        <span>{label}</span>
        <span className="text-xs text-muted-foreground italic">({entry.short})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5" data-testid={`term-${name}`}>
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`What is ${name}?`}
          data-testid={`term-trigger-${name}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-72 text-sm space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold">{name}</p>
          <p className="text-foreground">{entry.short}</p>
          {entry.long && <p className="text-muted-foreground text-xs">{entry.long}</p>}
          {entry.source && (
            <p className="text-muted-foreground text-[10px] italic">
              Source: {entry.source}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}
