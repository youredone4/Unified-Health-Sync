import { useState } from "react";
import { DISEASE_CONDITION_DEFAULTS } from "@shared/schema";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const OTHER_VALUE = "__OTHER__";

interface ConditionPickerProps {
  /** Current condition string. */
  value: string;
  /** Called whenever the user selects a known item or types in Other. */
  onChange: (next: string) => void;
  /** Distinct conditions previously used (drives "Previously recorded" group). */
  existingConditions: string[];
  /** Optional test id prefix so multiple pickers in the same form can be distinguished. */
  testIdPrefix?: string;
}

/**
 * Single dropdown + Other-free-text picker for a disease condition.
 *
 * Renders the PIDSR-categorized default list plus any conditions that
 * have already been recorded (so something typed via "Other..." once
 * stays available for next time). Picking "Other (type below)" reveals
 * an Input where the user types a brand-new condition; the typed value
 * becomes the picker's value.
 *
 * Stateless wrt. the form library — caller just owns the `value` string
 * and gets the new value via `onChange`. Designed to be rendered N times
 * for multi-condition cases (HIV + TB co-infection, etc.).
 */
export function ConditionPicker({ value, onChange, existingConditions, testIdPrefix = "condition" }: ConditionPickerProps) {
  const defaultNames = new Set(DISEASE_CONDITION_DEFAULTS.map((d) => d.name));
  const customConditions = existingConditions.filter((c) => !defaultNames.has(c));
  const groupedConditions: Array<{ label: string; items: string[] }> = [
    { label: "PIDSR Cat-I — immediate (24h)", items: DISEASE_CONDITION_DEFAULTS.filter((d) => d.group === "PIDSR_CAT_I").map((d) => d.name) },
    { label: "PIDSR Cat-II — weekly cutoff",  items: DISEASE_CONDITION_DEFAULTS.filter((d) => d.group === "PIDSR_CAT_II").map((d) => d.name) },
    { label: "Endemic / commonly flagged",     items: DISEASE_CONDITION_DEFAULTS.filter((d) => d.group === "ENDEMIC").map((d) => d.name) },
    ...(customConditions.length > 0 ? [{ label: "Previously recorded", items: customConditions }] : []),
  ];
  const allKnownNames = new Set([...DISEASE_CONDITION_DEFAULTS.map((d) => d.name), ...customConditions]);

  const [isOtherMode, setIsOtherMode] = useState<boolean>(() => !!value && !allKnownNames.has(value));
  const [customCondition, setCustomCondition] = useState<string>(() =>
    value && !allKnownNames.has(value) ? value : "",
  );

  return (
    <div>
      <Select
        onValueChange={(v) => {
          if (v === OTHER_VALUE) {
            setIsOtherMode(true);
            onChange(customCondition);
          } else {
            setIsOtherMode(false);
            onChange(v);
          }
        }}
        value={isOtherMode ? OTHER_VALUE : value || ""}
      >
        <SelectTrigger data-testid={`${testIdPrefix}-select`}>
          <SelectValue placeholder="Select condition" />
        </SelectTrigger>
        <SelectContent>
          {groupedConditions.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </div>
          ))}
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t mt-1">
            Custom
          </div>
          <SelectItem value={OTHER_VALUE}>Other (type below)</SelectItem>
        </SelectContent>
      </Select>
      {isOtherMode && (
        <Input
          className="mt-2"
          placeholder="Type the condition (e.g. Mpox, Lyme disease)"
          value={customCondition}
          onChange={(e) => {
            setCustomCondition(e.target.value);
            onChange(e.target.value);
          }}
          data-testid={`${testIdPrefix}-other`}
        />
      )}
    </div>
  );
}
