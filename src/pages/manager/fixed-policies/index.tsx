"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw } from "lucide-react";
import { getFixedPoliciesWithCurrentStatus } from "@/lib/fixed-policies/tracking";
import { getNextFixedStatus } from "@/lib/fixed-policies/status-transitions";
import { getDraftDateStatus } from "@/lib/fixed-policies/draft-date-status";
import { getAllHandledPolicies } from "@/lib/handled-policies";
import { createFixedPolicyTracking } from "@/lib/fixed-policies/tracking";
import { Badge } from "@/components/ui/badge";
import { formatEasternDate } from "@/lib/timezone";
import { AlertCircle, CheckCircle2, Clock, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FixedPolicyRow = {
  id: string;
  deal_id: number | null;
  submission_id: string;
  retention_agent_name: string;
  fixed_at: string;
  status_when_fixed: string;
  draft_date: string | null;
  notes: string | null;
  disposition: string | null;
  monday_com_deals: {
    id: number;
    policy_number: string | null;
    carrier: string | null;
    ghl_name: string | null;
    deal_name: string | null;
    phone_number: string | null;
    policy_status: string | null;
    ghl_stage: string | null;
    status: string | null;
  } | null;
};

export default function FixedPoliciesPage() {
  const { toast } = useToast();
  // Separate loading states for better UX
  const [loadingHandled, setLoadingHandled] = useState(false);
  const [loadingFixed, setLoadingFixed] = useState(false);
  const [loadingRejected, setLoadingRejected] = useState(false);
  const [fixedPolicies, setFixedPolicies] = useState<FixedPolicyRow[]>([]);
  const [handledPolicies, setHandledPolicies] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"fixed" | "handled" | "rejected">("handled");
  const [rejectedPolicies, setRejectedPolicies] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [attentionFilter, setAttentionFilter] = useState<string>("all"); // "all" | "needs_confirmation" | "future_draft" | "past_draft"
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [markingAsFixed, setMarkingAsFixed] = useState<string | null>(null);
  const [rejectingPolicy, setRejectingPolicy] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(100);

  const loadFixedPolicies = useCallback(async () => {
    setLoadingFixed(true);
    try {
      const data = await getFixedPoliciesWithCurrentStatus({
        retentionAgentName: agentFilter !== "all" ? agentFilter : undefined,
        statusWhenFixed: statusFilter !== "all" ? statusFilter : undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      setFixedPolicies((data ?? []) as FixedPolicyRow[]);
    } catch (error) {
      console.error("[fixed-policies] Error loading:", error);
      toast({
        title: "Error",
        description: "Failed to load fixed policies",
        variant: "destructive",
      });
    } finally {
      setLoadingFixed(false);
    }
  }, [agentFilter, statusFilter, page, pageSize, toast]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const loadHandledPolicies = useCallback(async () => {
    setLoadingHandled(true);
    try {
      const data = await getAllHandledPolicies({
        agentName: agentFilter !== "all" ? agentFilter : undefined,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      setHandledPolicies(data ?? []);
    } catch (error) {
      console.error("[fixed-policies] Error loading handled policies:", error);
      toast({
        title: "Error",
        description: "Failed to load handled policies",
        variant: "destructive",
      });
    } finally {
      setLoadingHandled(false);
    }
  }, [agentFilter, debouncedSearch, page, pageSize, toast]);

  const loadRejectedPolicies = useCallback(async () => {
    setLoadingRejected(true);
    try {
      // Fetch rejected policies from retention_deal_flow
      let query = supabase
        .from("retention_deal_flow")
        .select(`
          submission_id,
          retention_agent,
          status,
          policy_status,
          draft_date,
          notes,
          policy_number,
          carrier,
          updated_at
        `)
        .eq("policy_status", "rejected")
        .order("updated_at", { ascending: false });

      if (agentFilter !== "all") {
        query = query.eq("retention_agent", agentFilter);
      }

      const { data: rejectedData, error } = await query;

      if (error) {
        console.error("[fixed-policies] Error loading rejected policies:", error);
        throw error;
      }

      if (!rejectedData || rejectedData.length === 0) {
        setRejectedPolicies([]);
        return;
      }

      // Get unique submission_ids to fetch monday_com_deals
      const submissionIds = Array.from(
        new Set(rejectedData.map((p) => p.submission_id).filter(Boolean))
      ) as string[];

      // Fetch monday_com_deals by matching monday_item_id to submission_id
      const { data: mondayDeals, error: dealsError } = await supabase
        .from("monday_com_deals")
        .select("id, policy_number, ghl_name, deal_name, phone_number, carrier, policy_status, ghl_stage, status, monday_item_id")
        .in("monday_item_id", submissionIds)
        .eq("is_active", true);

      if (dealsError) {
        console.error("[fixed-policies] Error fetching monday deals for rejected policies:", dealsError);
      }

      // Create a map of monday_item_id -> deal
      const dealsBySubmissionId = new Map();
      (mondayDeals ?? []).forEach((deal) => {
        const mondayItemId = typeof deal.monday_item_id === "string" ? deal.monday_item_id.trim() : null;
        if (mondayItemId && deal) {
          dealsBySubmissionId.set(mondayItemId, deal);
        }
      });

      // Transform data to match expected format
      const transformed = rejectedData.map((policy) => {
        const mondayDeal = dealsBySubmissionId.get(policy.submission_id) ?? null;
        
        return {
          submission_id: policy.submission_id,
          retention_agent: policy.retention_agent,
          status: policy.status,
          policy_status: policy.policy_status,
          draft_date: policy.draft_date,
          notes: policy.notes,
          policy_number: policy.policy_number,
          carrier: policy.carrier,
          updated_at: policy.updated_at,
          monday_com_deals: mondayDeal ? {
            id: mondayDeal.id,
            policy_number: typeof mondayDeal.policy_number === "string" ? mondayDeal.policy_number : null,
            ghl_name: typeof mondayDeal.ghl_name === "string" ? mondayDeal.ghl_name : null,
            deal_name: typeof mondayDeal.deal_name === "string" ? mondayDeal.deal_name : null,
            phone_number: typeof mondayDeal.phone_number === "string" ? mondayDeal.phone_number : null,
            carrier: typeof mondayDeal.carrier === "string" ? mondayDeal.carrier : null,
            policy_status: typeof mondayDeal.policy_status === "string" ? mondayDeal.policy_status : null,
            ghl_stage: typeof mondayDeal.ghl_stage === "string" ? mondayDeal.ghl_stage : null,
            status: typeof mondayDeal.status === "string" ? mondayDeal.status : null,
          } : null,
        };
      });

      setRejectedPolicies(transformed);
    } catch (error) {
      console.error("[fixed-policies] Error loading rejected policies:", error);
      toast({
        title: "Error",
        description: "Failed to load rejected policies",
        variant: "destructive",
      });
    } finally {
      setLoadingRejected(false);
    }
  }, [agentFilter, toast]);

  const handleMarkAsFixed = useCallback(async (policy: any) => {
    setMarkingAsFixed(policy.submission_id);
    try {
      // Get deal_id from monday_com_deals if available
      let dealId: number | null = null;
      if (policy.monday_com_deals?.id) {
        dealId = policy.monday_com_deals.id;
      }

      // Get current status from monday_com_deals or use status from daily_deal_flow
      const statusWhenFixed = 
        policy.monday_com_deals?.policy_status ?? 
        policy.monday_com_deals?.ghl_stage ?? 
        policy.status ?? 
        "Unknown";

      const result = await createFixedPolicyTracking({
        dealId,
        submissionId: policy.submission_id,
        retentionAgentName: policy.retention_agent,
        statusWhenFixed,
        draftDate: policy.draft_date,
        notes: policy.notes,
        disposition: policy.status,
      });

      if (result) {
        toast({
          title: "Success",
          description: "Policy marked as fixed",
        });
        // Reload all relevant lists based on current view
        await Promise.all([
          loadFixedPolicies(),
          loadHandledPolicies(),
          loadRejectedPolicies(),
        ]);
      } else {
        throw new Error("Failed to mark as fixed");
      }
    } catch (error) {
      console.error("[fixed-policies] Error marking as fixed:", error);
      toast({
        title: "Error",
        description: "Failed to mark policy as fixed",
        variant: "destructive",
      });
    } finally {
      setMarkingAsFixed(null);
    }
  }, [loadFixedPolicies, loadHandledPolicies, loadRejectedPolicies, toast]);

  const handleReject = useCallback(async (policy: any) => {
    setRejectingPolicy(policy.submission_id);
    try {
      // Mark policy as rejected using policy_status field
      const { error } = await supabase
        .from("retention_deal_flow")
        .update({
          policy_status: "rejected",
          notes: policy.notes ? `${policy.notes} [Rejected]`.trim() : "[Rejected]",
        })
        .eq("submission_id", policy.submission_id);

      if (error) {
        console.error("[fixed-policies] Error rejecting policy:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Policy marked as rejected",
      });
      // Reload all relevant lists
      await Promise.all([
        loadHandledPolicies(),
        loadRejectedPolicies(),
      ]);
    } catch (error) {
      console.error("[fixed-policies] Error rejecting policy:", error);
      toast({
        title: "Error",
        description: "Failed to reject policy",
        variant: "destructive",
      });
    } finally {
      setRejectingPolicy(null);
    }
  }, [loadHandledPolicies, loadRejectedPolicies, toast]);

  const loadFilterOptions = useCallback(async () => {
    try {
      // Load unique agents from both fixed_policies_tracking and retention_deal_flow
      const [fixedAgentsResult, handledAgentsResult] = await Promise.all([
        supabase
        .from("fixed_policies_tracking")
        .select("retention_agent_name")
          .not("retention_agent_name", "is", null),
        supabase
          .from("retention_deal_flow")
          .select("retention_agent")
          .not("retention_agent", "is", null)
      ]);

      const fixedAgents = (fixedAgentsResult.data ?? [])
            .map((a) => (typeof a.retention_agent_name === "string" ? a.retention_agent_name.trim() : null))
        .filter((a): a is string => a != null && a.length > 0);

      const handledAgents = (handledAgentsResult.data ?? [])
        .map((a) => (typeof a.retention_agent === "string" ? a.retention_agent.trim() : null))
        .filter((a): a is string => a != null && a.length > 0);

      // Combine and deduplicate
      const allAgents = Array.from(new Set([...fixedAgents, ...handledAgents])).sort();
      setAvailableAgents(allAgents);

      // Load unique statuses from fixed_policies_tracking
      const { data: statusData } = await supabase
        .from("fixed_policies_tracking")
        .select("status_when_fixed")
        .not("status_when_fixed", "is", null);

      const statuses = Array.from(
        new Set(
          (statusData ?? [])
            .map((s) => (typeof s.status_when_fixed === "string" ? s.status_when_fixed.trim() : null))
            .filter((s): s is string => s != null && s.length > 0)
        )
      ).sort();

      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("[fixed-policies] Error loading filter options:", error);
    }
  }, []);

  // Load filter options once on mount
  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  // Load data when view mode or filters change
  useEffect(() => {
    if (viewMode === "fixed") {
      void loadFixedPolicies();
    } else if (viewMode === "rejected") {
      void loadRejectedPolicies();
    } else {
      void loadHandledPolicies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, agentFilter, debouncedSearch, page]); // Only depend on actual filter values

  // Smart auto-refresh: only when tab is visible and every 10 minutes
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    let interval: NodeJS.Timeout | null = null;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Reload when tab becomes visible
        if (viewMode === "fixed") {
          void loadFixedPolicies();
        } else if (viewMode === "rejected") {
          void loadRejectedPolicies();
        } else {
          void loadHandledPolicies();
        }
      }
    };

    // Set up visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Auto-refresh every 10 minutes when tab is visible
    if (document.visibilityState === "visible") {
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          if (viewMode === "fixed") {
            void loadFixedPolicies();
          } else if (viewMode === "rejected") {
            void loadRejectedPolicies();
          } else {
            void loadHandledPolicies();
          }
        }
      }, 10 * 60 * 1000); // 10 minutes
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (interval) {
        clearInterval(interval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]); // Only depend on viewMode for auto-refresh

  const filteredPolicies = useMemo(() => {
    // Search is now handled server-side for handled policies
    if (viewMode === "handled") {
      // Agent and search filters are already applied server-side
      // Only apply attention filters client-side
      return handledPolicies.filter((policy) => {
        // Filter out rejected and fixed policies (only show handled)
        if (policy.policy_status === "rejected" || policy.policy_status === "fixed") {
          return false;
        }
        // Only show policies with status 'handled' or 'pending' (legacy support)
        if (policy.policy_status && policy.policy_status !== "handled" && policy.policy_status !== "pending") {
          return false;
        }
        
        // Apply attention filter (search is handled server-side)
        if (attentionFilter === "needs_confirmation") {
          const draftStatus = getDraftDateStatus(policy.draft_date, policy.status);
          if (!draftStatus.needsConfirmation) return false;
        } else if (attentionFilter === "past_draft") {
          const draftStatus = getDraftDateStatus(policy.draft_date, policy.status);
          if (draftStatus.isFuture || !policy.draft_date) return false;
        } else if (attentionFilter === "future_draft") {
          const draftStatus = getDraftDateStatus(policy.draft_date, policy.status);
          if (!draftStatus.isFuture) return false;
        }
        
        return true;
      });
    }
    
    // Fixed view filtering (search still client-side for fixed policies)
    const searchLower = debouncedSearch.toLowerCase().trim();
    return fixedPolicies.filter((policy) => {
      // Apply search filter
      const matchesSearch =
        !searchLower ||
        (policy.monday_com_deals?.policy_number ?? "").toLowerCase().includes(searchLower) ||
        (policy.monday_com_deals?.ghl_name ?? "").toLowerCase().includes(searchLower) ||
        (policy.monday_com_deals?.deal_name ?? "").toLowerCase().includes(searchLower) ||
        (policy.monday_com_deals?.phone_number ?? "").toLowerCase().includes(searchLower) ||
        (policy.retention_agent_name ?? "").toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Apply agent filter
      if (agentFilter !== "all") {
        if ((policy.retention_agent_name ?? "").trim() !== agentFilter.trim()) {
          return false;
        }
      }

      // Apply status filter
      if (statusFilter !== "all") {
        if ((policy.status_when_fixed ?? "").trim() !== statusFilter.trim()) {
          return false;
        }
      }

      // Attention filter removed for Fixed tab - only applies to Handled tab
      return true;
    });
  }, [fixedPolicies, handledPolicies, debouncedSearch, agentFilter, statusFilter, attentionFilter, viewMode]);

  // Summary stats removed for Fixed tab - draft date logic only applies to Handled tab

  // Calculate summary statistics for handled policies
  const handledStats = useMemo(() => {
    const stats = {
      total: handledPolicies.length,
      needsConfirmation: 0,
      uniqueAgents: 0,
      pastDraftDate: 0,
      avgBusinessDaysPast: 0,
      maxBusinessDaysPast: 0,
    };

    const uniqueAgentsSet = new Set<string>();
    const pastDraftBusinessDays: number[] = [];

    handledPolicies.forEach((policy) => {
      // Count unique agents
      if (policy.retention_agent) {
        uniqueAgentsSet.add(policy.retention_agent.trim());
      }

      // Check if needs confirmation (2+ business days past draft date)
      // For handled policies, we use the status field to determine if 3-day rule applies
      const draftStatus = getDraftDateStatus(policy.draft_date, policy.status);
      if (draftStatus.needsConfirmation) {
        stats.needsConfirmation++;
      }
      
      // Count policies with passed draft dates
      if (!draftStatus.isFuture && policy.draft_date) {
        stats.pastDraftDate++;
        pastDraftBusinessDays.push(draftStatus.businessDaysSince);
        if (draftStatus.businessDaysSince > stats.maxBusinessDaysPast) {
          stats.maxBusinessDaysPast = draftStatus.businessDaysSince;
        }
      }
    });

    stats.uniqueAgents = uniqueAgentsSet.size;
    
    // Calculate average business days past
    if (pastDraftBusinessDays.length > 0) {
      stats.avgBusinessDaysPast = Math.round(
        (pastDraftBusinessDays.reduce((sum, days) => sum + days, 0) / pastDraftBusinessDays.length) * 10
      ) / 10;
    }

    return stats;
  }, [handledPolicies]);


  const getCurrentStatus = (policy: FixedPolicyRow): string => {
    return (
      policy.monday_com_deals?.policy_status ??
      policy.monday_com_deals?.ghl_stage ??
      policy.monday_com_deals?.status ??
      "—"
    );
  };

  const getNextStatus = (policy: FixedPolicyRow): string => {
    const nextStatus = getNextFixedStatus(policy.status_when_fixed);
    return nextStatus ?? "—";
  };

  // Helper functions for handled policies
  const getHandledCurrentStatus = (policy: any): string => {
    return (
      policy.monday_com_deals?.policy_status ??
      policy.monday_com_deals?.ghl_stage ??
      policy.monday_com_deals?.status ??
      policy.status ??
      "—"
    );
  };

  const getHandledNextStatus = (policy: any): string => {
    const statusWhenFixed = policy.status ?? getHandledCurrentStatus(policy);
    const nextStatus = getNextFixedStatus(statusWhenFixed);
    return nextStatus ?? "—";
  };

  return (
    <div className="w-full px-8 py-10 min-h-screen bg-muted/20">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fixed Policies Tracking</CardTitle>
              <CardDescription>
                {viewMode === "handled" 
                  ? "Policies handled by agents - Mark as fixed when ready"
                  : viewMode === "rejected"
                  ? "Policies rejected by managers"
                  : "Track policies marked as 'Fixed' and monitor their progress"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={viewMode === "handled" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("handled")}
                >
                  Handled ({handledPolicies.length})
                </Button>
                <Button
                  variant={viewMode === "fixed" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("fixed")}
                >
                  Fixed ({fixedPolicies.length})
                </Button>
                <Button
                  variant={viewMode === "rejected" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("rejected")}
                >
                  Rejected ({rejectedPolicies.length})
                </Button>
              </div>
              <Button 
                onClick={() => {
                  setPage(0); // Reset to first page on refresh
                  if (viewMode === "fixed") {
                    void loadFixedPolicies();
                  } else if (viewMode === "rejected") {
                    void loadRejectedPolicies();
                  } else {
                    void loadHandledPolicies();
                  }
                }} 
                disabled={loadingFixed || loadingHandled || loadingRejected} 
                variant="outline"
              >
                {(loadingFixed || loadingHandled || loadingRejected) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <Input
                placeholder="Search by policy #, name, phone, or agent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[300px]"
              />
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {viewMode === "fixed" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {availableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
              {/* Attention filter only for Handled tab */}
              {viewMode === "handled" && (
              <Select value={attentionFilter} onValueChange={setAttentionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Policies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Policies</SelectItem>
                      <SelectItem value="needs_confirmation">
                        ⚠️ Needs Confirmation ({handledStats.needsConfirmation})
                      </SelectItem>
                      <SelectItem value="past_draft">
                        📅 Past Draft Date ({handledStats.pastDraftDate})
                      </SelectItem>
                      <SelectItem value="future_draft">
                        🔮 Future Draft
                      </SelectItem>
                </SelectContent>
              </Select>
              )}
            </div>

            {/* Summary Cards for Handled View */}
            {viewMode === "handled" && handledPolicies.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Handled</div>
                    <div className="text-2xl font-bold">{handledStats.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Policies handled by agents
                    </div>
                  </CardContent>
                </Card>
                <Card className={handledStats.needsConfirmation > 0 ? "border-destructive" : ""}>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Needs Confirmation
                    </div>
                    <div className={`text-2xl font-bold ${handledStats.needsConfirmation > 0 ? "text-destructive" : ""}`}>
                      {handledStats.needsConfirmation}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ready to mark as Fixed or Rejected
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      (2+ business days past draft)
                    </div>
                    {handledStats.needsConfirmation > 0 && handledStats.avgBusinessDaysPast > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 font-medium">
                        Avg: {handledStats.avgBusinessDaysPast} business days past
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className={handledStats.pastDraftDate > 0 ? "border-orange-500" : ""}>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Past Draft Date
                    </div>
                    <div className={`text-2xl font-bold ${handledStats.pastDraftDate > 0 ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      {handledStats.pastDraftDate}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Draft date has passed
                    </div>
                    {handledStats.pastDraftDate > 0 && handledStats.maxBusinessDaysPast > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Max: {handledStats.maxBusinessDaysPast} business days
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Active Agents
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {handledStats.uniqueAgents}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Agents with handled policies
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Summary Cards - Only for Handled View */}
            {/* Fixed and Rejected tabs don't show status cards */}

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy #</TableHead>
                    <TableHead>Insured Name</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>RA Name</TableHead>
                    {viewMode === "fixed" ? (
                      <>
                        <TableHead>Status When Fixed</TableHead>
                        <TableHead>Current Status</TableHead>
                        <TableHead>Next Fixed Status</TableHead>
                        <TableHead>Draft Date</TableHead>
                        <TableHead>Fixed Date</TableHead>
                      </>
                    ) : viewMode === "rejected" ? (
                      <>
                        <TableHead>Status</TableHead>
                        <TableHead>Current Status</TableHead>
                        <TableHead>Draft Date</TableHead>
                        <TableHead>Rejected Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Status When Handled</TableHead>
                        <TableHead>Current Status</TableHead>
                        <TableHead>Next Fixed Status</TableHead>
                        <TableHead>Draft Date</TableHead>
                        <TableHead>Draft Status</TableHead>
                        <TableHead>Days Past Draft</TableHead>
                        <TableHead>Handled Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </>
                    )}
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewMode === "handled" ? (
                    <>
                      {loadingHandled && handledPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : handledPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          No handled policies found
                        </TableCell>
                      </TableRow>
                    ) : filteredPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          No handled policies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPolicies
                        .map((policy) => {
                          const draftStatus = getDraftDateStatus(policy.draft_date, policy.status);
                          const currentStatus = getHandledCurrentStatus(policy);
                          const nextStatus = getHandledNextStatus(policy);
                          const statusWhenHandled = policy.status ?? "—";
                          const hasPassedDraftDate = !draftStatus.isFuture && policy.draft_date;
                          
                          return (
                            <TableRow 
                              key={policy.submission_id}
                              className={hasPassedDraftDate ? "bg-red-500/10 hover:bg-red-500/15" : ""}
                            >
                              <TableCell className="font-mono text-sm">
                                {policy.monday_com_deals?.policy_number ?? policy.policy_number ?? "—"}
                              </TableCell>
                              <TableCell>
                                {policy.monday_com_deals?.ghl_name ?? policy.monday_com_deals?.deal_name ?? "—"}
                              </TableCell>
                              <TableCell>{policy.monday_com_deals?.carrier ?? policy.carrier ?? "—"}</TableCell>
                              <TableCell className="font-medium">{policy.retention_agent ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{statusWhenHandled}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{currentStatus}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={nextStatus !== "—" ? "default" : "secondary"}>{nextStatus}</Badge>
                              </TableCell>
                              <TableCell>
                                {policy.draft_date ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">{formatEasternDate(policy.draft_date)}</span>
                                    {draftStatus.isFuture && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Future date
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                {policy.draft_date ? (
                                  <div className="flex flex-col gap-1">
                                    <Badge 
                                      variant={
                                        draftStatus.statusVariant === "warning" 
                                          ? "default" 
                                          : draftStatus.statusVariant === "success"
                                          ? "default"
                                          : draftStatus.statusVariant === "destructive"
                                          ? "destructive"
                                          : draftStatus.statusVariant === "secondary"
                                          ? "secondary"
                                          : "default"
                                      }
                                      className="w-fit"
                                    >
                                      {draftStatus.statusMessage}
                                    </Badge>
                                    {draftStatus.confirmationMessage && (
                                      <div className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {draftStatus.confirmationMessage}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">No draft date</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {hasPassedDraftDate ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-destructive">
                                      {draftStatus.businessDaysSince} {draftStatus.businessDaysSince === 1 ? "day" : "days"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">past draft</span>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatEasternDate(policy.updated_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => void handleMarkAsFixed(policy)}
                                    disabled={markingAsFixed === policy.submission_id || rejectingPolicy === policy.submission_id}
                                  >
                                    {markingAsFixed === policy.submission_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-1" />
                                        Fixed
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void handleReject(policy)}
                                    disabled={rejectingPolicy === policy.submission_id || markingAsFixed === policy.submission_id}
                                  >
                                    {rejectingPolicy === policy.submission_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs truncate" title={policy.notes ?? ""}>
                                {policy.notes ?? "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </>
                  ) : viewMode === "rejected" ? (
                    <>
                      {loadingRejected && rejectedPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : rejectedPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No rejected policies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      rejectedPolicies
                        .filter((policy) => {
                          // Apply search filter
                          const searchLower = search.toLowerCase().trim();
                          if (searchLower) {
                            const matchesSearch = 
                              (policy.monday_com_deals?.policy_number ?? "").toLowerCase().includes(searchLower) ||
                              (policy.monday_com_deals?.ghl_name ?? "").toLowerCase().includes(searchLower) ||
                              (policy.monday_com_deals?.deal_name ?? "").toLowerCase().includes(searchLower) ||
                              (policy.monday_com_deals?.phone_number ?? "").toLowerCase().includes(searchLower) ||
                              (policy.retention_agent ?? "").toLowerCase().includes(searchLower) ||
                              (policy.notes ?? "").toLowerCase().includes(searchLower);
                            return matchesSearch;
                          }
                          return true;
                        })
                        .map((policy) => {
                          return (
                            <TableRow 
                              key={policy.submission_id}
                            >
                              <TableCell className="font-mono text-sm">
                                {policy.monday_com_deals?.policy_number ?? policy.policy_number ?? "—"}
                              </TableCell>
                              <TableCell>
                                {policy.monday_com_deals?.ghl_name ?? policy.monday_com_deals?.deal_name ?? "—"}
                              </TableCell>
                              <TableCell>{policy.monday_com_deals?.carrier ?? policy.carrier ?? "—"}</TableCell>
                              <TableCell className="font-medium">{policy.retention_agent ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">Rejected</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{policy.status ?? "—"}</Badge>
                              </TableCell>
                              <TableCell>
                                {policy.draft_date ? formatEasternDate(policy.draft_date) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatEasternDate(policy.updated_at)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    // Unreject: set policy_status back to 'handled'
                                    const { error } = await supabase
                                      .from("retention_deal_flow")
                                      .update({ policy_status: "handled" })
                                      .eq("submission_id", policy.submission_id);
                                    if (!error) {
                                      toast({
                                        title: "Success",
                                        description: "Policy unrejected",
                                      });
                                      await loadRejectedPolicies();
                                    }
                                  }}
                                >
                                  Unreject
                                </Button>
                              </TableCell>
                              <TableCell className="max-w-xs truncate" title={policy.notes ?? ""}>
                                {policy.notes ?? "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </>
                  ) : (
                    <>
                      {loadingFixed && fixedPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPolicies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No fixed policies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPolicies.map((policy) => {
                        const currentStatus = getCurrentStatus(policy);
                        const nextStatus = getNextStatus(policy);

                        return (
                          <TableRow 
                            key={policy.id}
                          >
                            <TableCell className="font-mono text-sm">
                              {policy.monday_com_deals?.policy_number ?? "—"}
                            </TableCell>
                            <TableCell>
                              {policy.monday_com_deals?.ghl_name ?? policy.monday_com_deals?.deal_name ?? "—"}
                            </TableCell>
                            <TableCell>{policy.monday_com_deals?.carrier ?? "—"}</TableCell>
                            <TableCell>{policy.retention_agent_name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{policy.status_when_fixed}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{currentStatus}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={nextStatus !== "—" ? "default" : "secondary"}>{nextStatus}</Badge>
                            </TableCell>
                            <TableCell>
                              {policy.draft_date ? formatEasternDate(policy.draft_date) : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatEasternDate(policy.fixed_at)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={policy.notes ?? ""}>
                              {policy.notes ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            {((viewMode === "handled" || viewMode === "fixed") && filteredPolicies.length > 0) || (viewMode === "rejected" && rejectedPolicies.length > 0) ? (
              <div className="text-sm text-muted-foreground">
                {viewMode === "handled" ? (
                  <>Showing {filteredPolicies.length} handled polic{filteredPolicies.length !== 1 ? "ies" : "y"}</>
                ) : viewMode === "rejected" ? (
                  <>Showing {rejectedPolicies.length} rejected polic{rejectedPolicies.length !== 1 ? "ies" : "y"}</>
                ) : (
                  <>Showing {filteredPolicies.length} of {fixedPolicies.length} fixed polic{filteredPolicies.length !== 1 ? "ies" : "y"}</>
                )}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

