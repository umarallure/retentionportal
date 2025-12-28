import React from "react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus } from "lucide-react";

import { DEAL_GROUPS } from "./deal-groups";
import {
  BulkAssignAllocationRow,
  type BulkAssignAgentOption,
  type BulkAssignAllocationRowValue,
} from "./bulk-assign-allocation-row";
import {
  buildLeadIdPlan,
  computeAllocationCounts,
  isValidPercentTotal,
  normalizeAllocations,
  type AllocationInput,
} from "./bulk-assign-utils";

type BulkAssignModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: BulkAssignAgentOption[];
  onCompleted?: () => void;
};

type DealRow = {
  monday_item_id: string | null;
};

type LeadRow = {
  id: string;
  submission_id: string | null;
};

async function ensureLeadBySubmissionId(args: {
  submissionId: string;
}): Promise<string | null> {
  const { submissionId } = args;

  const { data: existing, error: existingError } = await supabase
    .from("leads")
    .select("id")
    .eq("submission_id", submissionId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const payload: Record<string, unknown> = {
    submission_id: submissionId,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("leads")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted?.id ? (inserted.id as string) : null;
}

export function BulkAssignModal(props: BulkAssignModalProps) {
  const { toast } = useToast();
  const { open, onOpenChange, agents, onCompleted } = props;

  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [groupTitle, setGroupTitle] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");

  const [loadingGroup, setLoadingGroup] = React.useState(false);
  const [groupCount, setGroupCount] = React.useState<number | null>(null);
  const [assignedCount, setAssignedCount] = React.useState<number>(0);
  const [unassignedLeadIds, setUnassignedLeadIds] = React.useState<string[]>([]);

  const [allocations, setAllocations] = React.useState<BulkAssignAllocationRowValue[]>([
    { agentId: "", percent: 100 },
  ]);

  const [saving, setSaving] = React.useState(false);

  const cleanedAllocations = React.useMemo<AllocationInput[]>(
    () => normalizeAllocations(allocations),
    [allocations],
  );

  const percentTotal = React.useMemo(
    () => cleanedAllocations.reduce((acc, a) => acc + a.percent, 0),
    [cleanedAllocations],
  );

  const hasDuplicateAgents = React.useMemo(() => {
    const ids = cleanedAllocations.map((a) => a.agentId);
    return new Set(ids).size !== ids.length;
  }, [cleanedAllocations]);

  const computedCounts = React.useMemo(() => {
    return computeAllocationCounts(unassignedLeadIds.length, cleanedAllocations);
  }, [unassignedLeadIds.length, cleanedAllocations]);

  const canAssign =
    !!groupTitle &&
    unassignedLeadIds.length > 0 &&
    cleanedAllocations.length > 0 &&
    isValidPercentTotal(cleanedAllocations) &&
    !hasDuplicateAgents &&
    !saving;

  const reset = React.useCallback(() => {
    setGroupTitle("");
    setSearch("");
    setGroupCount(null);
    setAssignedCount(0);
    setUnassignedLeadIds([]);
    setAllocations([{ agentId: "", percent: 100 }]);
    setLoadingGroup(false);
    setSaving(false);
  }, []);

  React.useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const loadGroupLeads = React.useCallback(async () => {
    if (!groupTitle) {
      setGroupCount(null);
      setAssignedCount(0);
      setUnassignedLeadIds([]);
      return;
    }

    setLoadingGroup(true);
    try {
      const trimmed = search.trim();

      let dealsQuery = supabase
        .from("monday_com_deals")
        .select("monday_item_id", { count: "exact" })
        .eq("group_title", groupTitle)
        .not("monday_item_id", "is", null)
        .order("last_updated", { ascending: false, nullsFirst: false });

      if (trimmed) {
        const escaped = trimmed.replace(/,/g, "");
        dealsQuery = dealsQuery.or(
          `ghl_name.ilike.%${escaped}%,deal_name.ilike.%${escaped}%,phone_number.ilike.%${escaped}%,monday_item_id.ilike.%${escaped}%`,
        );
      }

      const { data: dealRows, error: dealsError, count } = await dealsQuery.limit(2000);
      if (dealsError) throw dealsError;

      setGroupCount(count ?? null);

      const submissionIds = Array.from(
        new Set(
          ((dealRows ?? []) as DealRow[])
            .map((d) => (typeof d.monday_item_id === "string" ? d.monday_item_id.trim() : ""))
            .filter((v) => v.length > 0),
        ),
      );

      if (submissionIds.length === 0) {
        setAssignedCount(0);
        setUnassignedLeadIds([]);
        return;
      }

      const { data: leadRows, error: leadsError } = await supabase
        .from("leads")
        .select("id, submission_id")
        .in("submission_id", submissionIds)
        .limit(10000);

      if (leadsError) throw leadsError;

      const bySubmission = new Map<string, string>();
      ((leadRows ?? []) as LeadRow[]).forEach((l) => {
        if (typeof l.submission_id === "string" && l.submission_id.trim().length) {
          bySubmission.set(l.submission_id.trim(), l.id);
        }
      });

      const ids: string[] = [];
      const missing: string[] = [];
      for (const sub of submissionIds) {
        const id = bySubmission.get(sub);
        if (id) ids.push(id);
        else missing.push(sub);
      }

      if (missing.length > 0) {
        const created: string[] = [];
        for (const sub of missing) {
          const newId = await ensureLeadBySubmissionId({ submissionId: sub });
          if (newId) created.push(newId);
        }
        ids.push(...created);
      }

      const { data: assignedRows, error: assignedError } = await supabase
        .from("retention_assigned_leads")
        .select("lead_id")
        .in("lead_id", ids)
        .eq("status", "active")
        .limit(10000);

      if (assignedError) throw assignedError;

      const assignedSet = new Set<string>((assignedRows ?? []).map((r) => r.lead_id as string));
      setAssignedCount(assignedSet.size);
      setUnassignedLeadIds(ids.filter((id) => !assignedSet.has(id)));
    } catch (e) {
      console.error("[bulk-assign] loadGroupLeads error", e);
      toastRef.current({
        title: "Failed to load group",
        description: "Could not load leads for the selected group.",
        variant: "destructive",
      });
      setGroupCount(null);
      setAssignedCount(0);
      setUnassignedLeadIds([]);
    } finally {
      setLoadingGroup(false);
    }
  }, [groupTitle, search]);

  React.useEffect(() => {
    if (!open) return;
    void loadGroupLeads();
  }, [open, loadGroupLeads]);

  const onAddAgent = () => {
    setAllocations((prev) => [...prev, { agentId: "", percent: 0 }]);
  };

  const onRemoveAgent = (idx: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const onChangeRow = (idx: number, v: BulkAssignAllocationRowValue) => {
    setAllocations((prev) => prev.map((row, i) => (i === idx ? v : row)));
  };

  const assignBulk = async () => {
    if (!canAssign) return;

    setSaving(true);
    try {
      const plan = buildLeadIdPlan(unassignedLeadIds, cleanedAllocations);
      if (plan.length === 0) {
        toast({
          title: "Nothing to assign",
          description: "No leads were selected for bulk assignment.",
          variant: "destructive",
        });
        return;
      }

      const now = new Date().toISOString();

      for (const p of plan) {
        const { error } = await supabase.from("retention_assigned_leads").insert({
          lead_id: p.lead_id,
          assignee_profile_id: p.assignee_profile_id,
          assigned_by_profile_id: p.assignee_profile_id,
          status: "active",
          assigned_at: now,
        });
        if (error) throw error;
      }

      toast({
        title: "Bulk assignment complete",
        description: `Assigned ${plan.length} leads across ${cleanedAllocations.length} agent(s).`,
      });

      onOpenChange(false);
      onCompleted?.();
    } catch (e) {
      console.error("[bulk-assign] assignBulk error", e);
      toast({
        title: "Bulk assignment failed",
        description: "Could not assign leads in bulk. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Bulk Assign Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Group Category</div>
              <Select value={groupTitle} onValueChange={setGroupTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_GROUPS.map((g) => (
                    <SelectItem key={g.id} value={g.title}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Search within group (optional)</div>
              <Input
                placeholder="Search name, phone, submission ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!groupTitle}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">Selected group summary</div>
                <div className="text-muted-foreground">
                  {loadingGroup ? (
                    <span className="inline-flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </span>
                  ) : groupTitle ? (
                    <>
                      Total leads in this group: <span className="font-medium">{groupCount ?? "—"}</span>
                      <span className="mx-2">•</span>
                      Already assigned: <span className="font-medium">{assignedCount}</span>
                      <span className="mx-2">•</span>
                      Unassigned: <span className="font-medium">{unassignedLeadIds.length}</span>
                    </>
                  ) : (
                    "Select a group to load leads."
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={loadGroupLeads} disabled={!groupTitle || loadingGroup || saving}>
                {loadingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reload
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Agent allocation</div>
                <div className="text-xs text-muted-foreground">
                  Percentages can total up to 100%. Only that portion of unassigned leads will be assigned.
                </div>
              </div>
              <Button variant="outline" onClick={onAddAgent} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" /> Add agent
              </Button>
            </div>

            <div className="space-y-2">
              {allocations.map((row, idx) => (
                <BulkAssignAllocationRow
                  key={idx}
                  value={row}
                  agents={agents}
                  disabled={saving}
                  canRemove={allocations.length > 1}
                  onRemove={() => onRemoveAgent(idx)}
                  onChange={(v) => onChangeRow(idx, v)}
                />
              ))}
            </div>

            <div className="rounded-md border p-3 bg-background">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Total</div>
                <div className={"text-sm " + (isValidPercentTotal(cleanedAllocations) ? "text-emerald-700" : "text-destructive")}>
                  {percentTotal}%
                </div>
              </div>
              {hasDuplicateAgents ? (
                <div className="text-xs text-destructive mt-2">Each agent can only be added once.</div>
              ) : null}
              {!isValidPercentTotal(cleanedAllocations) ? (
                <div className="text-xs text-destructive mt-2">Total percentage must be between 1% and 100%.</div>
              ) : null}

              {unassignedLeadIds.length > 0 && cleanedAllocations.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {computedCounts.map((c) => {
                    const agent = agents.find((a) => a.id === c.agentId);
                    return (
                      <div key={c.agentId} className="flex items-center justify-between rounded border px-2 py-1">
                        <div className="truncate">{agent?.display_name ?? c.agentId}</div>
                        <div className="ml-2 text-foreground font-medium">{c.count}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={assignBulk} disabled={!canAssign}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Bulk Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
