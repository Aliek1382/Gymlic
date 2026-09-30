"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTechniques } from "../hooks/use-techniques";
import { AddTechniqueDialog } from "./add-technique-dialog";

// Radix Select rejects an item whose value is "", so "no technique" gets a
// sentinel that never reaches the API.
const NONE = "__none__";

/**
 * Optional technique for one exercise: empty = no technique. Lists the
 * trainer's own bank and can add to it in place.
 */
export function TechniquePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (techniqueId: string | null) => void;
}) {
  const techniques = useTechniques();
  const items = techniques.data ?? [];

  return (
    <div className="flex items-center gap-1">
      <Select
        value={value ?? NONE}
        onValueChange={(next) => onChange(next === NONE ? null : next)}
      >
        <SelectTrigger className="w-full justify-start">
          <SelectValue placeholder="بدون تکنیک" className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>بدون تکنیک</SelectItem>
          {items.map((technique) => (
            <SelectItem key={technique.id} value={technique.id}>
              {technique.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="shrink-0">
        <AddTechniqueDialog onCreated={onChange} />
      </div>
    </div>
  );
}
