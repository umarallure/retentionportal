import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export type BulkAssignAgentOption = {
  id: string;
  display_name: string | null;
};

export type BulkAssignAllocationRowValue = {
  agentId: string;
  percent: number;
};

export function BulkAssignAllocationRow(props: {
  value: BulkAssignAllocationRowValue;
  agents: BulkAssignAgentOption[];
  disabled?: boolean;
  onChange: (value: BulkAssignAllocationRowValue) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { value, agents, disabled, onChange, onRemove, canRemove } = props;

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-7">
        <Select
          value={value.agentId}
          onValueChange={(v) => onChange({ ...value, agentId: v })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select retention agent" />
          </SelectTrigger>
          <SelectContent position="popper">
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.display_name ?? a.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-4">
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(value.percent) ? value.percent : 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...value, percent: Number.isFinite(n) ? n : 0 });
            }}
            disabled={disabled}
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </div>
        </div>
      </div>

      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove agent"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
